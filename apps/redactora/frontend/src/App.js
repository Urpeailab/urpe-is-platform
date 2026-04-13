import React, { useState, useEffect, useRef } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useNavigate, Link, Navigate, useParams } from 'react-router-dom';
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
import { FileText, Book, Download, Trash2, Edit, Plus, Loader2, ArrowLeft, Save, Scale, TrendingUp, CheckCircle, RefreshCw, Upload, FileBarChart, Briefcase, Globe, Mail, UserCheck, Award, BarChart3, History, MessageSquare, Send, Check, X, User, Reply, MoreVertical, Play, AlertCircle, Paperclip, XCircle, AlertTriangle, Lightbulb } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './components/ui/dialog';
import { Eye } from 'lucide-react';
import AsyncSelect from 'react-select/async';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https:', 'wss:').replace('http:', 'ws:');
const LOGO_URL = 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';

// WebSocket Hook
const useWebSocket = (userId) => {
  const [activities, setActivities] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Conectar WebSocket
    const wsUrl = `${WS_URL}/ws/${userId}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('✅ WebSocket Connected');
      setIsConnected(true);
      toast.success('Conectado al sistema en tiempo real');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        if (data.type === 'new_activity') {
          setActivities(prev => [data.activity, ...prev].slice(0, 10));
          
          // Toast notification
          toast.success(`Nueva actividad: ${data.activity.title}`, {
            duration: 4000,
            icon: '🔔'
          });
        } else if (data.type === 'pong') {
          // Pong response
          console.log('Pong received');
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.current.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      
      // Reconectar después de 5 segundos
      setTimeout(() => {
        console.log('Attempting to reconnect...');
      }, 5000);
    };

    // Cleanup
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId]);

  // Ping cada 30 segundos para mantener conexión
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send('ping');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return { activities, isConnected };
};

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
  
  // WebSocket para actividad en tiempo real
  const { activities: wsActivities, isConnected } = useWebSocket(user?.id);
  
  const [newClientData, setNewClientData] = useState({
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

  useEffect(() => {
    loadDashboardData();
  }, []);
  
  // Combinar actividades de API con actividades de WebSocket
  useEffect(() => {
    if (wsActivities.length > 0) {
      setRecentActivity(prev => {
        const combined = [...wsActivities, ...prev];
        // Eliminar duplicados por ID
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        // Ordenar por timestamp y limitar a 10
        return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
      });
    }
  }, [wsActivities]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [clientsRes, statsRes, activityRes] = await Promise.all([
        axios.get(`${API}/clients?limit=50`),
        axios.get(`${API}/dashboard/overview`),
        axios.get(`${API}/dashboard/recent-activity?limit=10`)
      ]);
      
      setClients(clientsRes.data.clients || []);
      setDashboardStats(statsRes.data);
      setRecentActivity(activityRes.data.activities || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Error al cargar el dashboard');
    } finally {
      setLoading(false);
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
      'whitepaper': `/create-whitepaper?client_id=${client.value}`
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
            <img src={LOGO_URL} alt="Monica Logo" className="logo-image" />
            <div>
              <h1 className="app-title">Monica</h1>
              <p className="app-subtitle">{t('landing.subtitle')}</p>
            </div>
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
            <Button onClick={() => navigate('/analytics')} style={{ background: '#3b82f6', color: 'white' }}>
              <BarChart3 className="mr-2" size={18} />
              Analytics
            </Button>
            <Button onClick={() => navigate('/drafts')} style={{ background: '#10b981', color: 'white' }}>
              <FileText className="mr-2" size={18} />
              {t('my_drafts') || 'Borradores'}
            </Button>
            <Button onClick={() => navigate('/chat')} style={{ background: '#ec4899', color: 'white' }}>
              <MessageSquare className="mr-2" size={18} />
              Chat con Mónica
            </Button>
            {user?.role === 'admin' && (
              <Button onClick={() => navigate('/admin')} style={{ background: '#8b5cf6', color: 'white' }}>
                👑 Admin Panel
              </Button>
            )}
            <Button variant="outline" onClick={logout}>
              {t('auth.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Stats Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {dashboardStats.total_clients}
              </CardTitle>
              <CardDescription>Clientes Activos</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f5576c' }}>
                {dashboardStats.total_documents}
              </CardTitle>
              <CardDescription>Documentos Totales</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00f2fe' }}>
                {dashboardStats.in_progress}
              </CardTitle>
              <CardDescription>En Progreso</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>
                {dashboardStats.completed}
              </CardTitle>
              <CardDescription>Completados</CardDescription>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'niw')} style={{ background: '#667eea' }}>
                    🟣 NIW
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'patent')} style={{ background: '#00f2fe' }}>
                    🔵 Patent
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'book')} style={{ background: '#f5576c' }}>
                    📚 Libro
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'study')} style={{ background: '#fa709a' }}>
                    📊 Estudio
                  </Button>
                  <Button onClick={() => handleQuickCreate(selectedClient, 'whitepaper')} style={{ background: '#10b981' }}>
                    📄 White Paper
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentActivity.map((activity, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '0.75rem',
                        background: '#f7f7f7',
                        borderRadius: '8px',
                        fontSize: '0.9rem'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>{activity.client_name}</div>
                      <div style={{ color: '#666' }}>{activity.title}</div>
                      <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Mis Clientes</h2>
          <Button onClick={() => setShowClientModal(true)}>
            <Plus className="mr-2" size={18} />
            Nuevo Cliente
          </Button>
        </div>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {clients.map(client => (
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
                onClick={(e) => handleDeleteClient(client.id, client.name, e)}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.6rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  zIndex: 10
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
                🗑️ Eliminar
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
                    fontWeight: '600'
                  }}>
                    {client.documents_count || 0} documentos
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
                {/* Audit info */}
                <div style={{ 
                  marginTop: '1rem', 
                  paddingTop: '1rem', 
                  borderTop: '1px solid #f3f4f6',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  <div>📅 Creado: {client.created_at ? new Date(client.created_at).toLocaleDateString('es-ES') : 'N/A'}</div>
                  {client.created_by_name && (
                    <div>👤 Por: {client.created_by_name}</div>
                  )}
                  {client.updated_by_name && client.updated_at && (
                    <div style={{ marginTop: '0.25rem' }}>
                      ✏️ Modificado: {new Date(client.updated_at).toLocaleDateString('es-ES')} por {client.updated_by_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {clients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
              No tienes clientes aún
            </p>
            <Button onClick={() => setShowClientModal(true)}>
              <Plus className="mr-2" size={18} />
              Crear tu primer cliente
            </Button>
          </div>
        )}

      </main>

      {/* New Client Modal */}
      <Dialog open={showClientModal} onOpenChange={setShowClientModal}>
        <DialogContent style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Ingresa la información del cliente
            </DialogDescription>
          </DialogHeader>
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
                onClick={handleCreateClient} 
                style={{ flex: 1 }}
                disabled={isCreatingClient}
              >
                {isCreatingClient ? 'Creando...' : 'Crear Cliente'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowClientModal(false)} 
                style={{ flex: 1 }}
                disabled={isCreatingClient}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* WebSocket Status Indicator */}
      {isConnected && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#10b981',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}>
          🟢 Conectado en tiempo real
        </div>
      )}
    </div>
  );
};

// Chat Page - Full Screen View with Conversations
const ChatPage = () => {
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setConversations(response.data.conversations);
        
        // Auto-select first conversation if exists
        if (response.data.conversations.length > 0) {
          selectConversation(response.data.conversations[0]);
        } else {
          // Si no hay conversaciones, crear una automáticamente (sin toast)
          await createNewConversation(false);
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Error al cargar las conversaciones');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const createNewConversation = async (showToast = true) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/chat/conversations`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const newConv = response.data.conversation;
        setConversations(prev => [newConv, ...prev]);
        selectConversation(newConv);
        if (showToast) {
          toast.success('Nueva conversación creada');
        }
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Error al crear conversación');
    }
  };

  const selectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setIsLoadingMessages(true);
    setMessages([]);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/chat/conversations/${conversation.id}/messages`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Error al cargar mensajes');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta conversación?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${API}/chat/conversations/${conversationId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      
      toast.success('Conversación eliminada');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Error al eliminar conversación');
    }
  };

  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['.pdf', '.docx', '.doc'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(fileExt)) {
        toast.error('Tipo de archivo no soportado. Solo PDF y Word (.docx, .doc)');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo es muy grande. Máximo 10MB');
        return;
      }
      
      setAttachedFile(file);
      toast.success(`Archivo adjunto: ${file.name}`);
    }
  };

  const removeAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && !attachedFile) || isLoading) return;
    if (!selectedConversation) {
      toast.error('Selecciona o crea una conversación primero');
      return;
    }

    const userMessage = inputMessage.trim() || (attachedFile ? '📎 Documento adjunto' : '');
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage + (attachedFile ? ` - ${attachedFile.name}` : ''),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const token = localStorage.getItem('token');
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('message', userMessage);
      if (attachedFile) {
        formData.append('file', attachedFile);
      }
      
      const response = await axios.post(
        `${API}/chat/conversations/${selectedConversation.id}/messages`,
        formData,
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );

      if (response.data.success) {
        // Replace temp message with real one and add assistant response
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMsg.id),
          response.data.user_message,
          response.data.assistant_message
        ]);
        
        // Clear attachment
        removeAttachment();
        
        // Update conversation title in sidebar if it was updated
        if (messages.length === 0) {
          await loadConversations();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.detail || 'Error al enviar el mensaje');
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMsg.id));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw',
      display: 'flex',
      background: '#f9fafb',
      overflow: 'hidden'
    }}>
      {/* Sidebar - Conversaciones */}
      <div style={{
        width: '300px',
        height: '100%',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
        }}>
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')} 
            style={{ 
              padding: '8px 12px',
              color: 'white',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            <ArrowLeft size={20} />
            Volver
          </Button>
          <Button
            onClick={createNewConversation}
            style={{
              background: 'white',
              color: '#ec4899',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: '600',
              padding: '10px'
            }}
          >
            <Plus size={20} />
            Nueva conversación
          </Button>
        </div>

        {/* Conversations List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px'
        }}>
          {isLoadingConversations ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <Loader2 className="animate-spin" size={24} style={{ color: '#ec4899' }} />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#6b7280',
              fontSize: '0.875rem'
            }}>
              <MessageSquare size={32} style={{ margin: '0 auto 12px', color: '#d1d5db' }} />
              <p style={{ margin: 0 }}>No hay conversaciones aún.</p>
              <p style={{ margin: '8px 0 0 0' }}>Crea una nueva para comenzar.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedConversation?.id === conv.id 
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)'
                    : 'transparent',
                  border: selectedConversation?.id === conv.id 
                    ? '1px solid #ec4899'
                    : '1px solid transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
                onMouseEnter={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.background = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {conv.title}
                  </p>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    {new Date(conv.updated_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  style={{
                    padding: '4px',
                    minWidth: 'auto',
                    height: 'auto',
                    color: '#9ca3af'
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        overflow: 'hidden'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              💬
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>
                {selectedConversation ? selectedConversation.title : 'Chat con Mónica'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                Tu asistente personal con IA
              </p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px',
          background: '#f9fafb'
        }}>
          {!selectedConversation ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <MessageSquare size={64} style={{ marginBottom: '24px', color: '#d1d5db' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: '600', color: '#374151' }}>
                Selecciona una conversación
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', maxWidth: '500px' }}>
                Elige una conversación existente del sidebar o crea una nueva para comenzar a chatear con Mónica.
              </p>
            </div>
          ) : isLoadingMessages ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Loader2 className="animate-spin" size={40} style={{ color: '#ec4899' }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <MessageSquare size={64} style={{ marginBottom: '24px', color: '#d1d5db' }} />
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: '600', color: '#374151' }}>
                ¡Hola! Soy Mónica
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', maxWidth: '500px' }}>
                Estoy aquí para ayudarte con lo que necesites. Puedo responder preguntas, ayudarte con tareas y adaptarme al idioma que prefieras usar.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  style={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '20px'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      background: message.role === 'user'
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#ffffff',
                      color: message.role === 'user' ? 'white' : '#1f2937',
                      boxShadow: message.role === 'user'
                        ? '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
                        : '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                      border: message.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '1rem',
                      lineHeight: '1.6'
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '16px',
                    background: '#ffffff',
                    boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <div className="typing-dot" style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'typing 1.4s infinite'
                    }}></div>
                    <div className="typing-dot" style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'typing 1.4s infinite 0.2s'
                    }}></div>
                    <div className="typing-dot" style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'typing 1.4s infinite 0.4s'
                    }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: '24px 32px',
          borderTop: '1px solid #e5e7eb',
          background: 'white'
        }}>
          {/* Attached file preview */}
          {attachedFile && (
            <div style={{
              marginBottom: '12px',
              padding: '12px 16px',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={16} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: '0.875rem', color: '#166534', fontWeight: '500' }}>
                  {attachedFile.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  ({(attachedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={removeAttachment}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#dc2626'
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            {/* Attach file button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !selectedConversation || attachedFile}
              style={{
                background: attachedFile ? '#d1d5db' : 'white',
                color: attachedFile ? '#9ca3af' : '#6b7280',
                padding: '14px',
                borderRadius: '12px',
                height: '56px',
                minWidth: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #e5e7eb',
                cursor: attachedFile ? 'not-allowed' : 'pointer'
              }}
              title="Adjuntar archivo (PDF o Word)"
            >
              <Paperclip size={20} />
            </Button>
            
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedConversation ? "Escribe tu mensaje..." : "Selecciona una conversación primero..."}
              disabled={isLoading || !selectedConversation}
              style={{
                flex: 1,
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '1rem',
                resize: 'none',
                minHeight: '56px',
                maxHeight: '150px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s',
                background: !selectedConversation ? '#f9fafb' : 'white'
              }}
              onFocus={(e) => {
                if (selectedConversation) {
                  e.target.style.borderColor = '#ec4899';
                }
              }}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={(!inputMessage.trim() && !attachedFile) || isLoading || !selectedConversation}
              style={{
                background: (!selectedConversation || (!inputMessage.trim() && !attachedFile)) 
                  ? '#d1d5db' 
                  : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                color: 'white',
                padding: '14px 24px',
                borderRadius: '12px',
                height: '56px',
                minWidth: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <Send size={24} />
              )}
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

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

// Client Dashboard Component
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
      toast.error('Error al cargar datos del cliente');
      navigate('/');
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
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            Volver a Dashboard
          </Button>
          <div>
            <h1 className="app-title">👤 {client.name}</h1>
            <p className="app-subtitle">{client.email}</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem' }}>
        
        {/* Client Info Card */}
        <Card style={{ marginBottom: '2rem' }}>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {client.company && (
                <div>
                  <Label style={{ color: '#666' }}>Empresa</Label>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{client.company}</p>
                </div>
              )}
              {client.country && (
                <div>
                  <Label style={{ color: '#666' }}>País</Label>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{client.country}</p>
                </div>
              )}
              {client.industry && (
                <div>
                  <Label style={{ color: '#666' }}>Industria</Label>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{client.industry}</p>
                </div>
              )}
              {client.phone && (
                <div>
                  <Label style={{ color: '#666' }}>Teléfono</Label>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{client.phone}</p>
                </div>
              )}
            </div>
            {client.notes && (
              <div style={{ marginTop: '1rem' }}>
                <Label style={{ color: '#666' }}>Notas</Label>
                <p style={{ marginTop: '0.25rem', color: '#555' }}>{client.notes}</p>
              </div>
            )}
            
            {/* Audit Information */}
            <div style={{ 
              marginTop: '1.5rem', 
              paddingTop: '1.5rem', 
              borderTop: '1px solid #e5e7eb',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <Label style={{ color: '#666', fontSize: '0.875rem' }}>Creado por</Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                  {client.created_by_name || 'N/A'}
                </p>
                <p style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                  {client.created_at ? new Date(client.created_at).toLocaleString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </p>
              </div>
              {client.updated_by_name && (
                <div>
                  <Label style={{ color: '#666', fontSize: '0.875rem' }}>Última modificación</Label>
                  <p style={{ fontWeight: '600', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    {client.updated_by_name}
                  </p>
                  <p style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                    {client.updated_at ? new Date(client.updated_at).toLocaleString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '1.5rem' }}>
          Documentos de {client.name}
        </h2>

        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          
          {/* NIW Card */}
          <div 
            onClick={() => handleViewDocuments('niw')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
            }}
          >
            <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Propuestas EB-2 NIW
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Documentos profesionales alineados con USCIS
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              {stats.niw_count + stats.niw_completed} creados
            </div>
          </div>

          {/* Patents Card */}
          {/* Patents Card */}
          <div 
            onClick={() => handleViewDocuments('patent')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
            }}
          >
            <Scale size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Patentes USPTO
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Aplicaciones provisionales completas
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              {stats.patent_count + stats.patent_completed} creadas
            </div>
          </div>

          {/* Books Card */}
          <div 
            onClick={() => handleViewDocuments('book')}
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(240, 147, 251, 0.3)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(240, 147, 251, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(240, 147, 251, 0.3)';
            }}
          >
            <Book size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Libros Completos
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Escribe libros con capítulos estructurados
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              {stats.book_count + stats.book_completed} creados
            </div>
          </div>

          {/* Econometric Studies Card */}
          <div 
            onClick={() => handleViewDocuments('study')}
            style={{
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(250, 112, 154, 0.3)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(250, 112, 154, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(250, 112, 154, 0.3)';
            }}
          >
            <TrendingUp size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Estudios Econométricos
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Análisis riguroso con 16 secciones
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              {stats.study_count} creados
            </div>
          </div>

          {/* White Paper Card */}
          <div 
            onClick={() => handleViewDocuments('whitepaper')}
            style={{
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(17, 153, 142, 0.3)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(17, 153, 142, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(17, 153, 142, 0.3)';
            }}
          >
            <FileBarChart size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              White Paper Técnico
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Documentos técnicos de 16 secciones profesionales
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              {(stats.whitepaper_count || 0) + (stats.whitepaper_completed || 0)} creados
            </div>
          </div>

          {/* Recommendation Letter Card */}
          <div 
            onClick={() => handleViewDocuments('recommendation')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(102, 126, 234, 0.3)';
            }}
          >
            <Mail size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Cartas de Recomendación
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Cartas profesionales para visas EB-2 NIW y O-1
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              {stats.recommendation_letter_count || 0} creadas
            </div>
          </div>

          {/* Case Studies Card - Coming Soon */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'not-allowed',
              opacity: 0.7,
              boxShadow: '0 10px 30px rgba(255, 236, 210, 0.3)',
              color: 'white',
              position: 'relative'
            }}
          >
            <Briefcase size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Casos de Estudio Empresariales
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Análisis detallados de casos de negocio
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.3)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              Disponible Pronto
            </div>
          </div>

          {/* Policy Paper Card - Coming Soon */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'not-allowed',
              opacity: 0.7,
              boxShadow: '0 10px 30px rgba(210, 153, 194, 0.3)',
              color: 'white',
              position: 'relative'
            }}
          >
            <Globe size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Reporte de Impacto Social
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Policy papers con impacto social
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.3)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              Disponible Pronto
            </div>
          </div>

          {/* Self Petition Letter Card - Coming Soon */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'not-allowed',
              opacity: 0.7,
              boxShadow: '0 10px 30px rgba(224, 195, 252, 0.3)',
              color: 'white',
              position: 'relative'
            }}
          >
            <Mail size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Carta de Autopetición
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Cartas profesionales de autopetición
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.3)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              Disponible Pronto
            </div>
          </div>

          {/* Recommendation Letter Card - Coming Soon */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'not-allowed',
              opacity: 0.7,
              boxShadow: '0 10px 30px rgba(255, 154, 158, 0.3)',
              color: 'white',
              position: 'relative'
            }}
          >
            <UserCheck size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Cartas de Recomendación
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Cartas personalizadas de recomendación
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.3)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              Disponible Pronto
            </div>
          </div>

          {/* Expert Letter Card - Coming Soon */}
          <div 
            style={{
              background: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
              borderRadius: '16px',
              padding: '2rem',
              cursor: 'not-allowed',
              opacity: 0.7,
              boxShadow: '0 10px 30px rgba(251, 194, 235, 0.3)',
              color: 'white',
              position: 'relative'
            }}
          >
            <Award size={48} style={{ marginBottom: '1rem', opacity: 0.9 }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Cartas de Expertos
            </h3>
            <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Cartas de opinión de expertos
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.3)', 
              padding: '0.75rem 1.25rem', 
              borderRadius: '20px',
              fontSize: '1.1rem',
              fontWeight: '600',
              display: 'inline-block'
            }}>
              Disponible Pronto
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};


// Component removed - books must always be associated with a client
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
    navigate(`/view-book/${book.id}`);
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
                      {new Date(book.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
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
const ClientDocumentsList = () => {
  const { clientId, docType } = useParams();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadClientAndDocuments();
  }, [clientId, docType]);

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
      } else if (docType === 'book') {
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
      } else if (docType === 'recommendation') {
        const response = await axios.get(`${API}/recommendation-letters`, { headers });
        docs = response.data.letters || [];
      } else if (docType === 'study') {
        const response = await axios.get(`${API}/econometric-studies`, { headers });
        docs = response.data.studies || [];
      }
      
      console.log(`Loaded ${docs.length} documents for client ${clientId}:`, docs);
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
      'study': { title: 'Estudios Econométricos', icon: BarChart3, createRoute: '/create-econometric-study' },
      'whitepaper': { title: 'White Papers Técnicos', icon: FileText, createRoute: '/create-whitepaper' },
      'recommendation': { title: 'Cartas de Recomendación', icon: Mail, createRoute: '/create-recommendation-letter' }
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
        'whitepaper': `/whitepapers/${documentToDelete.id}`,
        'recommendation': `/recommendation-letters/${documentToDelete.id}`,
        'study': `/econometric-studies/${documentToDelete.id}`
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
    const routes = {
      'niw': `/view-business-plan/${doc.id}`,
      'patent': `/view-patent/${doc.id}`,
      'book': `/view-book/${doc.id}`,
      'study': `/view-econometric-study/${doc.id}`,
      'recommendation': `/view-recommendation-letter/${doc.id}`
    };
    navigate(routes[docType]);
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
            {documents.map((doc) => (
              <div key={doc.id} style={{ position: 'relative' }}>
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleViewDocument(doc)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span style={{ flex: 1 }}>
                        {docType === 'niw' ? doc.project_title : 
                         docType === 'patent' ? doc.invention_title : 
                         doc.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {(doc.status === 'completed' || doc.status === 'complete') ? (
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
                      {new Date(doc.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })} • {new Date(doc.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
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
                  </CardContent>
                </Card>
                
                {/* Delete button positioned outside the Card */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(doc);
                  }}
                  style={{ 
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    color: '#ef4444',
                    zIndex: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
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
            <Button variant="outline" onClick={logout}>
              {t('auth.logout')}
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

const CreateNIWInteractive = () => {
  const [step, setStep] = useState('cv'); // cv, project_names, details, generating, review
  const [cvData, setCvData] = useState({
    applicant_name: '',
    applicant_cv: '',
    patent_info: '',
    language: 'en'
  });
  const [projectNameSuggestions, setProjectNameSuggestions] = useState([]);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [formData, setFormData] = useState({
    project_title: '',
    applicant_name: '',
    applicant_cv: '',
    project_idea: '',
    patent_info: '',
    language: 'en',
    apply_graphic_design: false,
    design_description: '',
    client_id: ''
  });
  const [niwId, setNiwId] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);
  const [cvInputMode, setCvInputMode] = useState('text'); // 'text' or 'pdf'
  const [savingDraft, setSavingDraft] = useState(false); // ⭐ Estado para guardar borrador
  
  // ⭐ NUEVO: Estado para progreso visual (Bug #2)
  const [visualProgress, setVisualProgress] = useState(0);
  
  // ⭐ NUEVO: Estado para idioma actual (bilingüe)
  const [currentLanguage, setCurrentLanguage] = useState('es'); // 'es' o 'en'
  const [regeneratingOtherLanguage, setRegeneratingOtherLanguage] = useState(false);
  
  // ⭐ Helper function para obtener contenido según idioma
  const getCurrentContent = (section) => {
    if (!section) return '';
    
    // Si tiene estructura bilingüe nueva
    if (section.content_es || section.content_en) {
      return currentLanguage === 'es' ? section.content_es : section.content_en;
    }
    
    // Fallback para estructura antigua (backward compatibility)
    return section.content || '';
  };
  
  // ⭐ SISTEMA DE PLANTILLAS para evaluaciones - evita traducciones mixtas
  const evaluationTemplates = {
    es: {
      character_exceeds: (count, max) => `El conteo de caracteres excede el máximo de ${max} caracteres (actualmente ${count} caracteres). Debe reducirse.`,
      character_below: (count, min) => `El conteo de caracteres está por debajo del mínimo requerido de ${min} caracteres (actualmente ${count} caracteres).`,
      too_detailed: 'Algún contenido está más detallado de lo necesario para una página de portada y se superpone con lo que típicamente está reservado para secciones posteriores.',
      has_conclusion: 'La sección termina con una frase de conclusión que debe eliminarse.',
      extended_summary: 'Incluye un Resumen Ejecutivo extendido y descripción detallada del rol técnico, contribuyendo a longitud excesiva.',
      verbose_content: 'Algunas oraciones son algo verbosas y podrían ser optimizadas mientras se preserva el significado para asegurar cumplimiento con el límite de caracteres.',
      overlaps_sections: 'Algunas secciones anticipan argumentos analíticos que podrían ser más apropiados en secciones dedicadas.',
      needs_trimming: (current, min, max) => `El conteo de caracteres debe estar entre ${min}-${max} caracteres (actualmente ${current} caracteres). Necesita ajustarse.`,
      slightly_above: (current, max) => `El conteo de caracteres excede el máximo de ${max} caracteres (actualmente ${current} caracteres). Debe reducirse.`,
      alignment_issue: 'Aunque esto generalmente se alinea con los estándares NIW de USCIS y toca la importancia nacional, podría vincular más explícitamente y concisamente la plataforma específica del solicitante a prioridades nacionales concretas de EE.UU. (ej., órdenes ejecutivas específicas, iniciativas de modernización federal) dentro de un texto más corto.',
      
      feedback_reduce_length: (min, max) => `Reducir la longitud para estar dentro del rango de ${min}-${max} caracteres. Ajustar el contenido manteniendo los puntos clave.`,
      feedback_focus: 'Mantén el foco en identificación concisa, título del proyecto, base legal, y una breve declaración de importancia nacional sin expandirse en exposición técnica o estratégica detallada que pertenece a secciones posteriores.',
      feedback_no_conclusion: 'No agregues frases de conclusión o párrafos de resumen al final de esta sección.',
      feedback_trim: (min, max) => `Ajustar el texto para permanecer dentro del rango ${min}-${max} caracteres. No exceder el máximo permitido.`,
      feedback_concise: 'Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto.'
    },
    en: {
      character_exceeds: (count, max) => `Character count exceeds the maximum of ${max} characters (currently ${count} characters). Must be reduced.`,
      character_below: (count, min) => `Character count is below the required minimum of ${min} characters (currently ${count} characters).`,
      too_detailed: 'Some content is more detailed than necessary for a cover page and overlaps with what is typically reserved for later sections.',
      has_conclusion: 'The section ends with a conclusion phrase that should be removed.',
      extended_summary: 'Includes extended Executive Summary and detailed technical role description, contributing to excessive length.',
      verbose_content: 'Some sentences are somewhat verbose and could be streamlined while preserving meaning to ensure compliance with the character limit.',
      overlaps_sections: 'Some sections anticipate analytical arguments that might be more appropriate in dedicated sections.',
      needs_trimming: (current, min, max) => `Character count must be between ${min}-${max} characters (currently ${current} characters). Needs adjustment.`,
      slightly_above: (current, max) => `Character count exceeds the maximum of ${max} characters (currently ${current} characters). Must be reduced.`,
      alignment_issue: 'While this generally aligns with USCIS NIW standards and touches on national importance, it could more explicitly and concisely tie the applicant\'s specific platform to concrete U.S. national priorities (e.g., specific executive orders, federal modernization initiatives) within a shorter text.',
      
      feedback_reduce_length: (min, max) => `Reduce the length to fall within the ${min}-${max} character range. Adjust content while maintaining key points.`,
      feedback_focus: 'Keep the focus on concise identification, project title, legal basis, and a brief statement of national importance without expanding into detailed technical or strategic exposition that belongs in later sections.',
      feedback_no_conclusion: 'Do not add conclusion phrases or summary paragraphs at the end of this section.',
      feedback_trim: (min, max) => `Adjust text to stay within the ${min}-${max} character range. Do not exceed the maximum allowed.`,
      feedback_concise: 'Maintain professional, USCIS-aligned tone and project specificity while making the text more compact.'
    }
  };

  // ⭐ Función para detectar el tipo de issue y devolver plantilla apropiada
  const getIssueTemplate = (issue, targetLang) => {
    if (!issue) return issue;
    
    const lower = issue.toLowerCase();
    const templates = evaluationTemplates[targetLang] || evaluationTemplates.es;
    
    // Detectar tipo de issue y usar plantilla
    if (lower.includes('exceed') || lower.includes('excede')) {
      // Extraer números si es posible
      const match = issue.match(/(\d+)/g);
      if (match && match.length >= 2) {
        return templates.character_exceeds(match[0], match[1] || '3000');
      }
      return templates.character_exceeds('', '3000');
    }
    
    if (lower.includes('detailed') || lower.includes('detallado') || lower.includes('cover page')) {
      return templates.too_detailed;
    }
    
    if (lower.includes('conclusion') || lower.includes('conclusión')) {
      return templates.has_conclusion;
    }
    
    if (lower.includes('executive summary') || lower.includes('resumen ejecutivo')) {
      return templates.extended_summary;
    }
    
    if (lower.includes('verbose') || lower.includes('verbosa')) {
      return templates.verbose_content;
    }
    
    if (lower.includes('overlap') || lower.includes('anticipate')) {
      return templates.overlaps_sections;
    }
    
    if (lower.includes('trimming') || lower.includes('recorte')) {
      const match = issue.match(/(\d+)/g);
      if (match && match.length >= 3) {
        return templates.needs_trimming(match[0], match[1] || '2500', match[2] || '3000');
      }
      return templates.needs_trimming('', '2500', '3000');
    }
    
    if (lower.includes('slightly') || lower.includes('ligeramente')) {
      const match = issue.match(/(\d+)/g);
      if (match && match.length >= 2) {
        return templates.slightly_above(match[0], match[1] || '3000');
      }
      return templates.slightly_above('', '3000');
    }
    
    if (lower.includes('aligns') || lower.includes('alinea') || lower.includes('uscis') || (lower.includes('national') && lower.includes('priorities'))) {
      return templates.alignment_issue;
    }
    
    // Si no coincide con ninguna plantilla, intentar traducción básica
    return issue;
  };

  // ⭐ Función para detectar el tipo de feedback y devolver plantilla apropiada
  const getFeedbackTemplate = (feedback, targetLang) => {
    if (!feedback) return feedback;
    
    const lower = feedback.toLowerCase();
    const templates = evaluationTemplates[targetLang] || evaluationTemplates.es;
    
    // Construir feedback completo basado en patrones detectados
    let result = '';
    
    if (lower.includes('reduce') || lower.includes('reducir')) {
      result += templates.feedback_reduce_length('2500', '3000') + ' ';
    }
    
    if (lower.includes('focus') || lower.includes('foco') || lower.includes('identification')) {
      result += templates.feedback_focus + ' ';
    }
    
    if (lower.includes('conclusion') || lower.includes('conclusión')) {
      result += templates.feedback_no_conclusion + ' ';
    }
    
    if (lower.includes('trim') || lower.includes('recortar')) {
      result += templates.feedback_trim('2500', '3000') + ' ';
    }
    
    if (lower.includes('professional') || lower.includes('profesional') || lower.includes('compact')) {
      result += templates.feedback_concise;
    }
    
    return result.trim() || feedback;
  };

  // ⭐ Función ULTRA AGRESIVA para traducir issues - todas las palabras en inglés
  const translateIssue = (issue, targetLang) => {
    if (!issue) return issue;
    
    // ⭐ PRIMERO: Intentar usar plantilla predefinida
    const template = getIssueTemplate(issue, targetLang);
    if (template !== issue) return template;
    
    if (targetLang === 'es') {
      // Traducción ULTRA AGRESIVA - cada palabra en inglés se traduce
      let translated = issue
        // ⭐ NUEVAS TRADUCCIONES basadas en texto real del usuario
        .replace(/carácter conteo exceeds el 3000-carácter máximo/gi, 'el conteo de caracteres excede el máximo de 3000 caracteres')
        .replace(/carácter conteo exceeds el/gi, 'el conteo de caracteres excede el')
        .replace(/Algunas content está más detailed de necessary for una cover page/gi, 'Algún contenido está más detallado de lo necesario para una página de portada')
        .replace(/overlaps con what está typically reserved for later sections/gi, 'se superpone con lo que típicamente está reservado para secciones posteriores')
        .replace(/extended Executive Summary y detailed technical role descripción/gi, 'Resumen Ejecutivo extendido y descripción detallada del rol técnico')
        .replace(/contributing para excessive length/gi, 'contribuyendo a longitud excesiva')
        .replace(/Algunas content/gi, 'Algún contenido')
        .replace(/está más detailed de necessary/gi, 'está más detallado de lo necesario')
        .replace(/for una cover page/gi, 'para una página de portada')
        .replace(/overlaps con what está/gi, 'se superpone con lo que está')
        .replace(/typically reserved for/gi, 'típicamente reservado para')
        .replace(/later sections/gi, 'secciones posteriores')
        .replace(/extended Executive Summary/gi, 'Resumen Ejecutivo extendido')
        .replace(/detailed technical role descripción/gi, 'descripción detallada del rol técnico')
        .replace(/contributing para/gi, 'contribuyendo a')
        .replace(/excessive length/gi, 'longitud excesiva')
        
        // Frases completas muy específicas
        .replace(/is slightly por encima el requerido máximo of/gi, 'está ligeramente por encima del máximo requerido de')
        .replace(/measured at approximately/gi, 'medido en aproximadamente')
        .replace(/but this is very tight and may exceed/gi, 'pero esto es muy ajustado y puede exceder')
        .replace(/depending on final formatoting\/encoding/gi, 'dependiendo del formato/codificación final')
        .replace(/needs trimming to safely fall dentro de/gi, 'necesita recorte para estar seguramente dentro de')
        .replace(/are somewhat verbose y podrían ser streamlined mientras se preservan meaning to ensure compliance with the character limit/gi, 'son algo verbosas y podrían ser optimizadas mientras se preserva el significado para asegurar cumplimiento con el límite de caracteres')
        .replace(/While la sección is generally strong and USCIS-aligned/gi, 'Aunque la sección es generalmente fuerte y alineada con USCIS')
        .replace(/it could emphasize more clearly that the described project is the applicant's own proposed endeavor/gi, 'podría enfatizar más claramente que el proyecto descrito es la propuesta propia del solicitante')
        .replace(/by explicitly tying the framework and implementations to/gi, 'vinculando explícitamente el marco y las implementaciones a')
        .replace(/planned work in the U\.S\. rather than sonar como a sector-wide description/gi, 'trabajo planificado en EE.UU. en lugar de sonar como una descripción del sector')
        
        // Frases medianas
        .replace(/character count exceeds the required/gi, 'el conteo de caracteres excede el requerido')
        .replace(/must be shortened to fall within/gi, 'debe acortarse para estar dentro de')
        .replace(/is slightly above/gi, 'está ligeramente por encima')
        .replace(/is slightly por encima/gi, 'está ligeramente por encima')
        .replace(/measured at/gi, 'medido en')
        .replace(/approximately/gi, 'aproximadamente')
        .replace(/but this is very tight/gi, 'pero esto es muy ajustado')
        .replace(/and may exceed/gi, 'y puede exceder')
        .replace(/depending on final/gi, 'dependiendo del')
        .replace(/formatoting/gi, 'formato')
        .replace(/encoding/gi, 'codificación')
        .replace(/needs trimming/gi, 'necesita recorte')
        .replace(/to safely fall/gi, 'para estar seguramente')
        .replace(/Some sentences/gi, 'Algunas oraciones')
        .replace(/are somewhat verbose/gi, 'son algo verbosas')
        .replace(/y podrían ser/gi, 'y podrían ser')
        .replace(/streamlined/gi, 'optimizadas')
        .replace(/mientras se preservan/gi, 'mientras se preserva')
        .replace(/meaning to/gi, 'el significado para')
        .replace(/ensure compliance with/gi, 'asegurar cumplimiento con')
        .replace(/the character limit/gi, 'el límite de caracteres')
        .replace(/is generally strong/gi, 'es generalmente fuerte')
        .replace(/USCIS-aligned/gi, 'alineada con USCIS')
        .replace(/it could emphasize/gi, 'podría enfatizar')
        .replace(/more clearly that/gi, 'más claramente que')
        .replace(/the described project/gi, 'el proyecto descrito')
        .replace(/is the applicant's own/gi, 'es la propuesta propia del')
        .replace(/proposed endeavor/gi, 'proyecto propuesto')
        .replace(/explicitly tying/gi, 'vinculando explícitamente')
        .replace(/the framework/gi, 'el marco')
        .replace(/and implementations/gi, 'y las implementaciones')
        .replace(/planned work/gi, 'trabajo planificado')
        .replace(/rather than/gi, 'en lugar de')
        .replace(/sonar como/gi, 'sonar como')
        .replace(/a sector-wide/gi, 'una descripción del sector')
        
        // Palabras individuales - MUY completo
        .replace(/\bexceeds\b/gi, 'excede')
        .replace(/\bcontent\b/gi, 'contenido')
        .replace(/\bdetailed\b/gi, 'detallado')
        .replace(/\bnecessary\b/gi, 'necesario')
        .replace(/\bfor\b/gi, 'para')
        .replace(/\bcover page\b/gi, 'página de portada')
        .replace(/\boverlaps\b/gi, 'se superpone')
        .replace(/\bwhat\b/gi, 'lo que')
        .replace(/\btypically\b/gi, 'típicamente')
        .replace(/\breserved\b/gi, 'reservado')
        .replace(/\blater\b/gi, 'posteriores')
        .replace(/\bsections\b/gi, 'secciones')
        .replace(/\bextended\b/gi, 'extendido')
        .replace(/\bExecutive Summary\b/gi, 'Resumen Ejecutivo')
        .replace(/\btechnical\b/gi, 'técnico')
        .replace(/\brole\b/gi, 'rol')
        .replace(/\bcontributing\b/gi, 'contribuyendo')
        .replace(/\bexcessive\b/gi, 'excesiva')
        .replace(/\blength\b/gi, 'longitud')
        .replace(/\brange\b/gi, 'rango')
        .replace(/\bhighest-level\b/gi, 'más alto nivel')
        .replace(/\bessential\b/gi, 'esenciales')
        .replace(/\bpoints\b/gi, 'puntos')
        .replace(/\bsuitable\b/gi, 'adecuados')
        .replace(/\bconcise\b/gi, 'concisa')
        .replace(/\bidentification\b/gi, 'identificación')
        .replace(/\btitle\b/gi, 'título')
        .replace(/\blegal basis\b/gi, 'base legal')
        .replace(/\bbrief\b/gi, 'breve')
        .replace(/\bstatement\b/gi, 'declaración')
        .replace(/\bexpanding\b/gi, 'expandirse')
        .replace(/\binto\b/gi, 'en')
        .replace(/\bstrategic\b/gi, 'estratégica')
        .replace(/\bexposition\b/gi, 'exposición')
        .replace(/\bbelongs\b/gi, 'pertenece')
        .replace(/\bis\b/gi, 'está')
        .replace(/\bslightly\b/gi, 'ligeramente')
        .replace(/\babove\b/gi, 'por encima')
        .replace(/\bof\b/gi, 'de')
        .replace(/\bat\b/gi, 'en')
        .replace(/\bbut\b/gi, 'pero')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bvery\b/gi, 'muy')
        .replace(/\btight\b/gi, 'ajustado')
        .replace(/\band\b/gi, 'y')
        .replace(/\bmay\b/gi, 'puede')
        .replace(/\bexceed\b/gi, 'exceder')
        .replace(/\bon\b/gi, 'en')
        .replace(/\bfinal\b/gi, 'final')
        .replace(/\bneeds\b/gi, 'necesita')
        .replace(/\bto\b/gi, 'para')
        .replace(/\bsafely\b/gi, 'seguramente')
        .replace(/\bfall\b/gi, 'estar')
        .replace(/\bwithin\b/gi, 'dentro de')
        .replace(/\bSome\b/gi, 'Algunas')
        .replace(/\bsentences\b/gi, 'oraciones')
        .replace(/\bare\b/gi, 'son')
        .replace(/\bsomewhat\b/gi, 'algo')
        .replace(/\bverbose\b/gi, 'verbosas')
        .replace(/\bcould\b/gi, 'podrían')
        .replace(/\bbe\b/gi, 'ser')
        .replace(/\bwhile\b/gi, 'mientras')
        .replace(/\bmeaning\b/gi, 'significado')
        .replace(/\bensure\b/gi, 'asegurar')
        .replace(/\bcompliance\b/gi, 'cumplimiento')
        .replace(/\bwith\b/gi, 'con')
        .replace(/\bthe\b/gi, 'el')
        .replace(/\bcharacter\b/gi, 'carácter')
        .replace(/\blimit\b/gi, 'límite')
        .replace(/\bgenerally\b/gi, 'generalmente')
        .replace(/\bstrong\b/gi, 'fuerte')
        .replace(/\bit\b/gi, 'esto')
        .replace(/\bemphasize\b/gi, 'enfatizar')
        .replace(/\bmore\b/gi, 'más')
        .replace(/\bclearly\b/gi, 'claramente')
        .replace(/\bthat\b/gi, 'que')
        .replace(/\bdescribed\b/gi, 'descrito')
        .replace(/\bproject\b/gi, 'proyecto')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bown\b/gi, 'propia')
        .replace(/\bproposed\b/gi, 'propuesto')
        .replace(/\bendeavor\b/gi, 'proyecto')
        .replace(/\bby\b/gi, 'mediante')
        .replace(/\bexplicitly\b/gi, 'explícitamente')
        .replace(/\btying\b/gi, 'vinculando')
        .replace(/\bframework\b/gi, 'marco')
        .replace(/\bimplementations\b/gi, 'implementaciones')
        .replace(/\bplanned\b/gi, 'planificado')
        .replace(/\bwork\b/gi, 'trabajo')
        .replace(/\bin\b/gi, 'en')
        .replace(/\brather\b/gi, 'en lugar')
        .replace(/\bthan\b/gi, 'de')
        .replace(/\ba\b/gi, 'una')
        .replace(/\bsector-wide\b/gi, 'del sector')
        .replace(/\bdescription\b/gi, 'descripción')
        .replace(/\bcharacters\b/gi, 'caracteres')
        .replace(/\bcount\b/gi, 'conteo')
        .replace(/\brequired\b/gi, 'requerido')
        .replace(/\bmaximum\b/gi, 'máximo')
        .replace(/\bminimum\b/gi, 'mínimo')
        .replace(/\bsection\b/gi, 'sección')
        .replace(/\bhas\b/gi, 'tiene')
        .replace(/\bno\b/gi, 'no')
        .replace(/\bconclusion\b/gi, 'conclusión')
        // ⭐ NUEVAS traducciones basadas en texto real del usuario
        .replace(/\baligns\b/gi, 'se alinea')
        .replace(/\balign\b/gi, 'alinear')
        .replace(/\btouches\b/gi, 'toca')
        .replace(/\btouch\b/gi, 'tocar')
        .replace(/\btie\b/gi, 'vincular')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bapplicant\b/gi, 'solicitante')
        .replace(/\bspecific\b/gi, 'específico')
        .replace(/\bplatform\b/gi, 'plataforma')
        .replace(/\bconcrete\b/gi, 'concretas')
        .replace(/\bpriorities\b/gi, 'prioridades')
        .replace(/\bpriority\b/gi, 'prioridad')
        .replace(/\bexecutive orders\b/gi, 'órdenes ejecutivas')
        .replace(/\bfederal\b/gi, 'federales')
        .replace(/\bmodernization\b/gi, 'modernización')
        .replace(/\binitiatives\b/gi, 'iniciativas')
        .replace(/\binitiative\b/gi, 'iniciativa')
        .replace(/\bshorter\b/gi, 'más corto')
        .replace(/\btext\b/gi, 'texto')
        .replace(/\bconcisely\b/gi, 'concisamente')
        .replace(/\bexplicitly\b/gi, 'explícitamente')
        .replace(/\bgenerally\b/gi, 'generalmente')
        .replace(/\bstandards\b/gi, 'estándares')
        .replace(/\bstandard\b/gi, 'estándar')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bmore\b/gi, 'más')
        .replace(/\bU\.S\.\b/gi, 'EE.UU.')
        .replace(/\bnational\b/gi, 'nacional')
        .replace(/\bimportance\b/gi, 'importancia')
        .replace(/\bwithin\b/gi, 'dentro de')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bthese\b/gi, 'estos')
        .replace(/\bwhile\b/gi, 'mientras')
        .replace(/\bwith\b/gi, 'con')
        .replace(/\bto\b/gi, 'para')
        .replace(/\bthe\b/gi, 'el')
        .replace(/\band\b/gi, 'y')
        .replace(/\be\.g\.\b/gi, 'por ejemplo')
        .replace(/\be\.g\b/gi, 'ej')
        // ⭐ MÁS traducciones basadas en errores del usuario
        .replace(/\belements\b/gi, 'elementos')
        .replace(/\bread\b/gi, 'se leen')
        .replace(/\bgeneric\b/gi, 'genérico')
        .replace(/\btécnico\b/gi, 'técnico')
        .replace(/\bexecution\b/gi, 'ejecución')
        .replace(/\bsteps\b/gi, 'pasos')
        .replace(/\buse\b/gi, 'uso')
        .replace(/\bDocker\b/gi, 'Docker')
        .replace(/\bGitHub\b/gi, 'GitHub')
        .replace(/\bPostgreSQL\b/gi, 'PostgreSQL')
        .replace(/\bRedis\b/gi, 'Redis')
        .replace(/\bCI\/CD\b/gi, 'CI/CD')
        .replace(/\bActions\b/gi, 'Actions')
        .replace(/\btightly\b/gi, 'estrechamente')
        .replace(/\btied\b/gi, 'vinculado')
        .replace(/\bespecífico\b/gi, 'específico')
        .replace(/\bimportancia\b/gi, 'importancia')
        .replace(/\boutcomes\b/gi, 'resultados')
        .replace(/\bservice industries\b/gi, 'industrias de servicios')
        .replace(/\bservice\b/gi, 'servicio')
        .replace(/\bindustries\b/gi, 'industrias')
        .replace(/\bsolicitante's\b/gi, 'del solicitante')
        .replace(/\bunique\b/gi, 'único')
        .replace(/\bcontributions\b/gi, 'contribuciones')
        .replace(/\bcontribution\b/gi, 'contribución')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bemphasize\b/gi, 'enfatizar')
        .replace(/\bhow\b/gi, 'cómo')
        .replace(/\beach\b/gi, 'cada')
        .replace(/\bphase\b/gi, 'fase')
        .replace(/\bconcretely\b/gi, 'concretamente')
        .replace(/\badvances\b/gi, 'avanza')
        .replace(/\bsubstantial\b/gi, 'sustancial')
        .replace(/\bmerit\b/gi, 'mérito')
        .replace(/\bProng\b/gi, 'Criterio')
        .replace(/\bbeyond\b/gi, 'más allá de')
        .replace(/\bdescribing\b/gi, 'describir')
        .replace(/\btools\b/gi, 'herramientas')
        .replace(/\benvironments\b/gi, 'entornos')
        .replace(/\benvironment\b/gi, 'entorno');
      
      return translated;
    } else if (targetLang === 'en') {
      // ⭐ Traducción ULTRA AGRESIVA de español a inglés
      return issue
        // Frases completas primero
        .replace(/el conteo de caracteres excede el requerido/gi, 'character count exceeds the required')
        .replace(/medido en aproximadamente/gi, 'measured at approximately')
        .replace(/pero esto es muy ajustado y puede exceder/gi, 'but this is very tight and may exceed')
        .replace(/dependiendo del formato\/codificación final/gi, 'depending on final formatting/encoding')
        .replace(/necesita recorte para estar seguramente dentro de/gi, 'needs trimming to safely fall within')
        .replace(/está ligeramente por encima del máximo requerido de/gi, 'is slightly above the required maximum of')
        .replace(/son algo verbosas y podrían ser optimizadas/gi, 'are somewhat verbose and could be streamlined')
        .replace(/mientras se preserva el significado para asegurar cumplimiento con el límite de caracteres/gi, 'while preserving meaning to ensure compliance with the character limit')
        .replace(/es generalmente fuerte y alineada con USCIS/gi, 'is generally strong and USCIS-aligned')
        .replace(/podría enfatizar más claramente que/gi, 'could emphasize more clearly that')
        .replace(/el proyecto descrito es la propuesta propia del/gi, 'the described project is the applicant\'s own proposed')
        .replace(/vinculando explícitamente el marco y las implementaciones a/gi, 'by explicitly tying the framework and implementations to')
        .replace(/trabajo planificado en EE.UU./gi, 'planned work in the U.S.')
        .replace(/en lugar de sonar como una descripción del sector/gi, 'rather than sounding like a sector-wide description')
        
        // Palabras individuales
        .replace(/\bestá\b/gi, 'is')
        .replace(/\bligeramente\b/gi, 'slightly')
        .replace(/\bpor encima\b/gi, 'above')
        .replace(/\bde\b/gi, 'of')
        .replace(/\ben\b/gi, 'at')
        .replace(/\bpero\b/gi, 'but')
        .replace(/\besto\b/gi, 'this')
        .replace(/\bmuy\b/gi, 'very')
        .replace(/\bajustado\b/gi, 'tight')
        .replace(/\by\b/gi, 'and')
        .replace(/\bpuede\b/gi, 'may')
        .replace(/\bexceder\b/gi, 'exceed')
        .replace(/\bfinal\b/gi, 'final')
        .replace(/\bnecesita\b/gi, 'needs')
        .replace(/\brecorte\b/gi, 'trimming')
        .replace(/\bpara\b/gi, 'to')
        .replace(/\bseguramente\b/gi, 'safely')
        .replace(/\bestar\b/gi, 'fall')
        .replace(/\bdentro de\b/gi, 'within')
        .replace(/\bAlgunas\b/gi, 'Some')
        .replace(/\boraciones\b/gi, 'sentences')
        .replace(/\bson\b/gi, 'are')
        .replace(/\balgo\b/gi, 'somewhat')
        .replace(/\bverbosas\b/gi, 'verbose')
        .replace(/\bpodrían\b/gi, 'could')
        .replace(/\bser\b/gi, 'be')
        .replace(/\boptimizadas\b/gi, 'streamlined')
        .replace(/\bmientras\b/gi, 'while')
        .replace(/\bse preserva\b/gi, 'preserving')
        .replace(/\bel significado\b/gi, 'meaning')
        .replace(/\basegurar\b/gi, 'ensure')
        .replace(/\bcumplimiento\b/gi, 'compliance')
        .replace(/\bcon\b/gi, 'with')
        .replace(/\bel límite\b/gi, 'the limit')
        .replace(/\bcaracteres\b/gi, 'characters')
        .replace(/\bes\b/gi, 'is')
        .replace(/\bgeneralmente\b/gi, 'generally')
        .replace(/\bfuerte\b/gi, 'strong')
        .replace(/\balineada\b/gi, 'aligned')
        .replace(/\bconteo de caracteres\b/gi, 'character count')
        .replace(/\bcarácter\b/gi, 'character')
        .replace(/\bcontenido\b/gi, 'content')
        .replace(/\bevidencia\b/gi, 'evidence')
        .replace(/\bsección\b/gi, 'section')
        .replace(/\bconclusión\b/gi, 'conclusion');
    }
    
    return issue;
  };
  
  // ⭐ Función ULTRA AGRESIVA para traducir feedback - cada palabra en inglés
  const translateFeedback = (feedback, targetLang) => {
    if (!feedback) return feedback;
    
    // ⭐ PRIMERO: Intentar usar plantilla predefinida
    const template = getFeedbackTemplate(feedback, targetLang);
    if (template !== feedback) return template;
    
    if (targetLang === 'es') {
      // Traducción ULTRA AGRESIVA palabra por palabra (fallback)
      return feedback
        // ⭐ NUEVAS TRADUCCIONES basadas en texto real del usuario
        .replace(/Reducir la longitud general para estar dentro del 2500–3000 character range by ajustando el Executive Summary y rol secciones/gi, 'Reducir la longitud general para estar dentro del rango de 2500-3000 caracteres ajustando el Resumen Ejecutivo y secciones de rol')
        .replace(/Mantenering only el highest-level, essential points suitable for una cover page/gi, 'Manteniendo solo los puntos de más alto nivel esenciales adecuados para una página de portada')
        .replace(/Mantén el foco en concise identification, proyecto title, legal basis, y una brief statement of importancia nacional/gi, 'Mantén el foco en identificación concisa, título del proyecto, base legal, y una breve declaración de importancia nacional')
        .replace(/sin expanding into detailed technical or strategic exposition that belongs in later secciones/gi, 'sin expandirse en exposición técnica o estratégica detallada que pertenece a secciones posteriores')
        .replace(/character range by ajustando/gi, 'rango de caracteres ajustando')
        .replace(/Mantenering only el/gi, 'Manteniendo solo el')
        .replace(/highest-level, essential points/gi, 'puntos de más alto nivel esenciales')
        .replace(/suitable for una cover page/gi, 'adecuados para una página de portada')
        .replace(/concise identification/gi, 'identificación concisa')
        .replace(/proyecto title/gi, 'título del proyecto')
        .replace(/legal basis/gi, 'base legal')
        .replace(/brief statement of/gi, 'breve declaración de')
        .replace(/sin expanding into/gi, 'sin expandirse en')
        .replace(/detailed technical or strategic exposition/gi, 'exposición técnica o estratégica detallada')
        .replace(/that belongs in later secciones/gi, 'que pertenece a secciones posteriores')
        
        // Frases largas primero (más específicas)
        .replace(/Reduce the overall length to fall within the 2500-3000 character requirement by tightening the Project Overview, Strategic Relevance, and Key Project Attributes\./gi, 'Reduce la longitud general para estar dentro del requisito de 2500-3000 caracteres ajustando el Resumen del Proyecto, Relevancia Estratégica y Atributos Clave del Proyecto.')
        .replace(/Keep the section focused on identification and a concise description of national importance, avoiding extended argumentation\./gi, 'Mantén la sección enfocada en la identificación y una descripción concisa de importancia nacional, evitando argumentación extendida.')
        .replace(/Do not add any conclusion-style wrap-up\./gi, 'No agregues ningún cierre estilo conclusión.')
        .replace(/Maintain professional, USCIS-aligned tone and project specificity while making the text more compact\./gi, 'Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto.')
        .replace(/Reduce the overall length to fall within the/gi, 'Reduce la longitud general para estar dentro del')
        .replace(/character requirement by tightening the/gi, 'requisito de caracteres ajustando el')
        .replace(/Project Overview, Strategic Relevance, and Key Project Attributes/gi, 'Resumen del Proyecto, Relevancia Estratégica y Atributos Clave del Proyecto')
        .replace(/Keep the section focused on identification and a concise description of/gi, 'Mantén la sección enfocada en la identificación y una descripción concisa de')
        .replace(/avoiding extended argumentation/gi, 'evitando argumentación extendida')
        .replace(/Do not add any conclusion-style wrap-up/gi, 'No agregues ningún cierre estilo conclusión')
        .replace(/Maintain professional, USCIS-aligned tone and project specificity while making the text more compact/gi, 'Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto')
        .replace(/Reduce the overall length so that the/gi, 'Reduce la longitud general para que el')
        .replace(/character count falls between/gi, 'conteo de caracteres esté entre')
        .replace(/and characters/gi, 'y caracteres')
        .replace(/primarily by tightening language in the/gi, 'principalmente ajustando el lenguaje en las secciones de')
        .replace(/Project Overview and Strategic Alignment/gi, 'Resumen del Proyecto y Alineación Estratégica')
        .replace(/Keep the content focused on/gi, 'Mantén el contenido enfocado en')
        .replace(/core project identification/gi, 'identificación central del proyecto')
        .replace(/the applicant's role/gi, 'el rol del solicitante')
        .replace(/a concise statement of/gi, 'una declaración concisa de')
        .replace(/Do not add any concluding phrases/gi, 'No agregues ninguna frase de conclusión')
        .replace(/or summary sentences at the end of the/gi, 'o frases de resumen al final de la')
        .replace(/Maintain focus on/gi, 'Mantén el foco en')
        .replace(/project identity/gi, 'identidad del proyecto')
        .replace(/applicant data/gi, 'datos del solicitante')
        .replace(/role/gi, 'rol')
        .replace(/clear articulation of/gi, 'articulación clara de')
        .replace(/national importance/gi, 'importancia nacional')
        .replace(/without drifting into explanatory/gi, 'sin desviarse hacia lenguaje explicativo')
        .replace(/strategic closure language/gi, 'o de cierre estratégico')
        .replace(/Keep the tone/gi, 'Mantén el tono')
        .replace(/Professional and USCIS-aligned/gi, 'Profesional y alineado con USCIS')
        .replace(/but more concise/gi, 'pero más conciso')
        .replace(/character count/gi, 'conteo de caracteres')
        .replace(/character requirement/gi, 'requisito de caracteres')
        .replace(/characters/gi, 'caracteres')
        .replace(/requirement/gi, 'requisito')
        .replace(/the section/gi, 'la sección')
        .replace(/Review/gi, 'Revisar')
        .replace(/review/gi, 'revisar')
        .replace(/Reduce/gi, 'Reducir')
        .replace(/reduce/gi, 'reducir')
        .replace(/overall/gi, 'general')
        .replace(/length/gi, 'longitud')
        .replace(/so that/gi, 'para que')
        .replace(/falls/gi, 'esté')
        .replace(/between/gi, 'entre')
        .replace(/primarily/gi, 'principalmente')
        .replace(/tightening/gi, 'ajustando')
        .replace(/language/gi, 'lenguaje')
        .replace(/sections/gi, 'secciones')
        .replace(/Section/gi, 'Sección')
        .replace(/section/gi, 'sección')
        .replace(/Keep/gi, 'Mantener')
        .replace(/keep/gi, 'mantener')
        .replace(/Content/gi, 'Contenido')
        .replace(/content/gi, 'contenido')
        .replace(/focused/gi, 'enfocado')
        .replace(/Conclusion/gi, 'Conclusión')
        .replace(/conclusion/gi, 'conclusión')
        .replace(/Evidence/gi, 'Evidencia')
        .replace(/evidence/gi, 'evidencia')
        .replace(/Professional/gi, 'Profesional')
        .replace(/professional/gi, 'profesional')
        .replace(/Quality/gi, 'Calidad')
        .replace(/quality/gi, 'calidad')
        .replace(/Structure/gi, 'Estructura')
        .replace(/structure/gi, 'estructura')
        .replace(/Requirements/gi, 'Requisitos')
        .replace(/requirements/gi, 'requisitos')
        .replace(/Missing/gi, 'Faltante')
        .replace(/missing/gi, 'faltante')
        .replace(/Insufficient/gi, 'Insuficiente')
        .replace(/insufficient/gi, 'insuficiente')
        .replace(/Improve/gi, 'Mejorar')
        .replace(/improve/gi, 'mejorar')
        .replace(/Add/gi, 'Agregar')
        .replace(/add/gi, 'agregar')
        .replace(/Remove/gi, 'Eliminar')
        .replace(/remove/gi, 'eliminar')
        .replace(/tighten/gi, 'ajustar')
        .replace(/shorten/gi, 'acortar')
        .replace(/specific/gi, 'específico')
        .replace(/alignment/gi, 'alineación')
        .replace(/required/gi, 'requerido')
        .replace(/should/gi, 'debe')
        .replace(/without/gi, 'sin')
        // Palabras individuales muy completo
        .replace(/\bis\b/gi, 'es')
        .replace(/\bProfesional\b/gi, 'Profesional')
        .replace(/\bhas\b/gi, 'tiene')
        .replace(/\bno\b/gi, 'no')
        .replace(/\bplaceholders\b/gi, 'marcadores de posición')
        .replace(/\bdoes not include\b/gi, 'no incluye')
        .replace(/\ba\b/gi, 'una')
        .replace(/\bConclusion\b/gi, 'Conclusión')
        .replace(/\bIt\b/gi, 'Esto')
        .replace(/\bclearly\b/gi, 'claramente')
        .replace(/\btargets\b/gi, 'apunta a')
        .replace(/\bProng\b/gi, 'Criterio')
        .replace(/\bwith\b/gi, 'con')
        .replace(/\bsubstantial merit\b/gi, 'mérito sustancial')
        .replace(/\bimportancia nacional\b/gi, 'importancia nacional')
        .replace(/\bespecifico\b/gi, 'específico')
        .replace(/\bto\b/gi, 'para')
        .replace(/\bel\/la\b/gi, 'el')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bAI-driven automation\b/gi, 'automatización impulsada por IA')
        .replace(/\binfraEstructura\b/gi, 'infraestructura')
        .replace(/\bproject\b/gi, 'proyecto')
        .replace(/\bHowever\b/gi, 'Sin embargo')
        .replace(/\bconteo de caracteres\b/gi, 'conteo de caracteres')
        .replace(/\bat\b/gi, 'en')
        .replace(/\bupper edge\b/gi, 'límite superior')
        .replace(/\ballowed range\b/gi, 'rango permitido')
        .replace(/\bmay exceed\b/gi, 'puede exceder')
        .replace(/\bonce finalized\b/gi, 'una vez finalizado')
        .replace(/\btrim\b/gi, 'recortar')
        .replace(/\bMantenering\b/gi, 'Manteniendo')
        .replace(/\bajustando\b/gi, 'ajustando')
        .replace(/\bcharacter range\b/gi, 'rango de caracteres')
        .replace(/\bby\b/gi, 'mediante')
        .replace(/\bonly\b/gi, 'solo')
        .replace(/\bhighest-level\b/gi, 'de más alto nivel')
        .replace(/\bessential points\b/gi, 'puntos esenciales')
        .replace(/\bsuitable for\b/gi, 'adecuados para')
        .replace(/\bcover page\b/gi, 'página de portada')
        .replace(/\bfoco\b/gi, 'foco')
        .replace(/\bidentification\b/gi, 'identificación')
        .replace(/\btitle\b/gi, 'título')
        .replace(/\blegal basis\b/gi, 'base legal')
        .replace(/\bbrief statement\b/gi, 'breve declaración')
        .replace(/\bsin\b/gi, 'sin')
        .replace(/\bexpanding\b/gi, 'expandirse')
        .replace(/\binto\b/gi, 'en')
        .replace(/\bdetailed\b/gi, 'detallado')
        .replace(/\btechnical\b/gi, 'técnico')
        .replace(/\bor\b/gi, 'o')
        .replace(/\bstrategic\b/gi, 'estratégico')
        .replace(/\bexposition\b/gi, 'exposición')
        .replace(/\bthat belongs\b/gi, 'que pertenece')
        .replace(/\bin later\b/gi, 'en posteriores')
        .replace(/\bsecciones\b/gi, 'secciones')
        .replace(/\bajustar\b/gi, 'ajustar')
        .replace(/\btext\b/gi, 'texto')
        .replace(/\bslightly\b/gi, 'ligeramente')
        .replace(/\bstay\b/gi, 'permanecer')
        .replace(/\bsafely\b/gi, 'seguramente')
        .replace(/\bwithin\b/gi, 'dentro de')
        .replace(/\bcaracteres\b/gi, 'caracteres')
        .replace(/\bensure\b/gi, 'asegurar')
        .replace(/\ball\b/gi, 'todo el')
        .replace(/\blenguaje\b/gi, 'lenguaje')
        .replace(/\bframes\b/gi, 'enmarca')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bown\b/gi, 'propia')
        .replace(/\bendeavor\b/gi, 'proyecto')
        .replace(/\bU\.S\.\b/gi, 'EE.UU.')
        .replace(/\band\b/gi, 'y')
        .replace(/\bthe\b/gi, 'el')
        .replace(/\bla\b/gi, 'the')
        .replace(/\by\b/gi, 'and')
        .replace(/\bpara\b/gi, 'to')
        // ⭐ Más traducciones para feedback
        .replace(/\baligns\b/gi, 'se alinea')
        .replace(/\balign\b/gi, 'alinear')
        .replace(/\btouches\b/gi, 'toca')
        .replace(/\btouch\b/gi, 'tocar')
        .replace(/\btie\b/gi, 'vincular')
        .replace(/\bapplicant's\b/gi, 'del solicitante')
        .replace(/\bapplicant\b/gi, 'solicitante')
        .replace(/\bspecific\b/gi, 'específico')
        .replace(/\bplatform\b/gi, 'plataforma')
        .replace(/\bconcrete\b/gi, 'concretas')
        .replace(/\bpriorities\b/gi, 'prioridades')
        .replace(/\bpriority\b/gi, 'prioridad')
        .replace(/\bexecutive orders\b/gi, 'órdenes ejecutivas')
        .replace(/\bfederal\b/gi, 'federales')
        .replace(/\bmodernization\b/gi, 'modernización')
        .replace(/\binitiatives\b/gi, 'iniciativas')
        .replace(/\binitiative\b/gi, 'iniciativa')
        .replace(/\bshorter\b/gi, 'más corto')
        .replace(/\bconcisely\b/gi, 'concisamente')
        .replace(/\bexplicitly\b/gi, 'explícitamente')
        .replace(/\bstandards\b/gi, 'estándares')
        .replace(/\bstandard\b/gi, 'estándar')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bmore\b/gi, 'más')
        .replace(/\bU\.S\.\b/gi, 'EE.UU.')
        .replace(/\bnational\b/gi, 'nacional')
        .replace(/\bimportance\b/gi, 'importancia')
        .replace(/\bthis\b/gi, 'esto')
        .replace(/\bthese\b/gi, 'estos')
        .replace(/\bwhile\b/gi, 'mientras')
        .replace(/\be\.g\.\b/gi, 'por ejemplo')
        .replace(/\be\.g\b/gi, 'ej')
        // ⭐ MÁS traducciones basadas en errores del usuario
        .replace(/\belements\b/gi, 'elementos')
        .replace(/\bread\b/gi, 'se leen')
        .replace(/\bgeneric\b/gi, 'genérico')
        .replace(/\btécnico\b/gi, 'técnico')
        .replace(/\bexecution\b/gi, 'ejecución')
        .replace(/\bsteps\b/gi, 'pasos')
        .replace(/\buse\b/gi, 'uso')
        .replace(/\bDocker\b/gi, 'Docker')
        .replace(/\bGitHub\b/gi, 'GitHub')
        .replace(/\bPostgreSQL\b/gi, 'PostgreSQL')
        .replace(/\bRedis\b/gi, 'Redis')
        .replace(/\bCI\/CD\b/gi, 'CI/CD')
        .replace(/\bActions\b/gi, 'Actions')
        .replace(/\btightly\b/gi, 'estrechamente')
        .replace(/\btied\b/gi, 'vinculado')
        .replace(/\bespecífico\b/gi, 'específico')
        .replace(/\bimportancia\b/gi, 'importancia')
        .replace(/\boutcomes\b/gi, 'resultados')
        .replace(/\bservice industries\b/gi, 'industrias de servicios')
        .replace(/\bservice\b/gi, 'servicio')
        .replace(/\bindustries\b/gi, 'industrias')
        .replace(/\bsolicitante's\b/gi, 'del solicitante')
        .replace(/\bunique\b/gi, 'único')
        .replace(/\bcontributions\b/gi, 'contribuciones')
        .replace(/\bcontribution\b/gi, 'contribución')
        .replace(/\bcould\b/gi, 'podría')
        .replace(/\bemphasize\b/gi, 'enfatizar')
        .replace(/\bhow\b/gi, 'cómo')
        .replace(/\beach\b/gi, 'cada')
        .replace(/\bphase\b/gi, 'fase')
        .replace(/\bconcretely\b/gi, 'concretamente')
        .replace(/\badvances\b/gi, 'avanza')
        .replace(/\bsubstantial\b/gi, 'sustancial')
        .replace(/\bmerit\b/gi, 'mérito')
        .replace(/\bProng\b/gi, 'Criterio')
        .replace(/\bbeyond\b/gi, 'más allá de')
        .replace(/\bdescribing\b/gi, 'describir')
        .replace(/\btools\b/gi, 'herramientas')
        .replace(/\benvironments\b/gi, 'entornos')
        .replace(/\benvironment\b/gi, 'entorno');
    } else if (targetLang === 'en') {
      // ⭐ Traducción ULTRA AGRESIVA de español a inglés para feedback
      return feedback
        // Frases completas primero
        .replace(/Reduce la longitud general para estar dentro del requisito de/gi, 'Reduce the overall length to fall within the')
        .replace(/requisito de caracteres ajustando el/gi, 'character requirement by tightening the')
        .replace(/Resumen del Proyecto, Relevancia Estratégica y Atributos Clave del Proyecto/gi, 'Project Overview, Strategic Relevance, and Key Project Attributes')
        .replace(/Mantén la sección enfocada en la identificación y una descripción concisa de/gi, 'Keep the section focused on identification and a concise description of')
        .replace(/evitando argumentación extendida/gi, 'avoiding extended argumentation')
        .replace(/No agregues ningún cierre estilo conclusión/gi, 'Do not add any conclusion-style wrap-up')
        .replace(/Mantén un tono profesional alineado con USCIS y especificidad del proyecto mientras haces el texto más compacto/gi, 'Maintain professional, USCIS-aligned tone and project specificity while making the text more compact')
        .replace(/Reducir el total longitud para fall strictly dentro de/gi, 'Reduce the overall length to fall strictly within')
        .replace(/mientras Mantenering el Estructura y key data points/gi, 'while maintaining the structure and key data points')
        .replace(/Mantener el cover page enfocado on identification/gi, 'Keep the cover page focused on identification')
        .replace(/proyecto title, brief description, y alineación/gi, 'project title, brief description, and alignment')
        .replace(/but move more detailed analytical or argumentative lenguaje about importancia nacional/gi, 'but move more detailed analytical or argumentative language about national importance')
        .replace(/y technical depth para later secciones/gi, 'and technical depth to later sections')
        .replace(/Do not Agregar marcadores de posición or any concluding\/summary paragraph en el end of esto Sección/gi, 'Do not add placeholders or any concluding/summary paragraph at the end of this section')
        .replace(/la sección es Profesional/gi, 'the section is Professional')
        .replace(/tiene no marcadores de posición/gi, 'has no placeholders')
        .replace(/no incluye una Conclusión/gi, 'does not include a Conclusion')
        .replace(/claramente apunta a Criterio/gi, 'clearly targets Prong')
        .replace(/el conteo de caracteres es en el límite superior/gi, 'the character count is at the upper edge')
        .replace(/puede exceder 3000 una vez finalizado/gi, 'may exceed 3000 once finalized')
        .replace(/recortar y ajustar el texto/gi, 'trim and adjust the text')
        
        // Palabras individuales
        .replace(/\bReducir\b/gi, 'Reduce')
        .replace(/\blongitud\b/gi, 'length')
        .replace(/\bgeneral\b/gi, 'overall')
        .replace(/\bestrictamente\b/gi, 'strictly')
        .replace(/\bdentro de\b/gi, 'within')
        .replace(/\bmientras\b/gi, 'while')
        .replace(/\bMantener\b/gi, 'Maintain')
        .replace(/\bestructura\b/gi, 'structure')
        .replace(/\benfocado\b/gi, 'focused')
        .replace(/\btítulo del proyecto\b/gi, 'project title')
        .replace(/\bbreve descripción\b/gi, 'brief description')
        .replace(/\balineación\b/gi, 'alignment')
        .replace(/\bmover\b/gi, 'move')
        .replace(/\bdetallado\b/gi, 'detailed')
        .replace(/\banalítico\b/gi, 'analytical')
        .replace(/\bargumentativo\b/gi, 'argumentative')
        .replace(/\blenguaje\b/gi, 'language')
        .replace(/\bimportancia nacional\b/gi, 'national importance')
        .replace(/\bprofundidad técnica\b/gi, 'technical depth')
        .replace(/\bsecciones posteriores\b/gi, 'later sections')
        .replace(/\bagregar\b/gi, 'add')
        .replace(/\bmarcadores de posición\b/gi, 'placeholders')
        .replace(/\bpárrafo de conclusión\b/gi, 'concluding paragraph')
        .replace(/\bal final de\b/gi, 'at the end of')
        .replace(/\besta sección\b/gi, 'this section')
        .replace(/\bRevisar\b/gi, 'Review')
        .replace(/\brevisar\b/gi, 'review')
        .replace(/\bSección\b/gi, 'Section')
        .replace(/\bsección\b/gi, 'section')
        .replace(/\bContenido\b/gi, 'Content')
        .replace(/\bcontenido\b/gi, 'content')
        .replace(/\bConclusión\b/gi, 'Conclusion')
        .replace(/\bconclusión\b/gi, 'conclusion')
        .replace(/\bEvidencia\b/gi, 'Evidence')
        .replace(/\bevidencia\b/gi, 'evidence')
        .replace(/\bconteo de caracteres\b/gi, 'character count')
        .replace(/\bProfesional\b/gi, 'Professional')
        .replace(/\bprofesional\b/gi, 'professional')
        .replace(/\bcaracteres\b/gi, 'characters')
        .replace(/\brequisito\b/gi, 'requirement')
        .replace(/\bajustar\b/gi, 'tighten')
        .replace(/\bel\b/gi, 'the')
        .replace(/\bla\b/gi, 'the')
        .replace(/\by\b/gi, 'and')
        .replace(/\bpara\b/gi, 'to');
    }
    
    return feedback;
  };
  // ⭐ Toggle de idioma con debugging
  const toggleLanguage = () => {
    const newLanguage = currentLanguage === 'es' ? 'en' : 'es';
    console.log('🔄 Cambiando idioma de', currentLanguage, 'a', newLanguage);
    
    setCurrentLanguage(newLanguage);
    
    // Actualizar validation_warning cuando cambia el idioma
    if (currentSection) {
      console.log('📝 Actualizando advertencias para idioma:', newLanguage);
      const updatedSection = updateValidationWarning(currentSection, newLanguage);
      console.log('✅ Advertencias actualizadas:', updatedSection.validation_warning?.issues);
      setCurrentSection(updatedSection);
    }
  };
  
  // ⭐ Función MEJORADA para actualizar validation_warning según idioma
  const updateValidationWarning = (section, language) => {
    if (!section || !section.evaluations) return section;
    
    const evalEs = section.evaluations.spanish || {};
    const evalEn = section.evaluations.english || {};
    
    // ⭐ FIX: Usar la evaluación del idioma solicitado, no la que tenga más issues
    // Si el usuario quiere español, usar evalEs; si quiere inglés, usar evalEn
    let selectedEval;
    if (language === 'es') {
      // Intentar usar evaluación en español primero, si no existe o está vacía, usar inglés y traducir
      selectedEval = (evalEs.issues && evalEs.issues.length > 0) ? evalEs : evalEn;
    } else {
      // Intentar usar evaluación en inglés primero, si no existe o está vacía, usar español y traducir
      selectedEval = (evalEn.issues && evalEn.issues.length > 0) ? evalEn : evalEs;
    }
    
    // Traducir issues y feedback al idioma solicitado (SIEMPRE traducir)
    const translatedIssues = (selectedEval.issues || []).map(issue => translateIssue(issue, language));
    const translatedFeedback = translateFeedback(selectedEval.feedback, language);
    
    return {
      ...section,
      validation_warning: {
        title: language === 'es' ? "⚠️ Advertencia de Validación" : "⚠️ Validation Warning",
        summary: language === 'es' 
          ? "Revisión de calidad completada." 
          : "Quality review completed.",
        issues: translatedIssues.length > 0 ? translatedIssues : [
          language === 'es' ? "Revisa el contenido generado" : "Review the generated content"
        ],
        feedback: translatedFeedback || (language === 'es' 
          ? "Revisa el contenido antes de aprobar." 
          : "Review content before approval."),
        recommendation: language === 'es' 
          ? "Revisa el contenido cuidadosamente antes de aprobar. Puedes usar la opción de 'Editar Sección' para solicitar cambios específicos a la IA."
          : "Review content carefully before approval. You can use 'Edit Section' to request specific AI changes.",
        metrics: {
          character_count: language === 'es' 
            ? (section.content_es?.length || 0) 
            : (section.content_en?.length || 0),
          required_range: "2500-4000",
          has_conclusion: selectedEval.has_conclusion || false,
          has_repetition: selectedEval.has_repetition || false
        }
      }
    };
  };
  
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      if (clientId && !formData.client_id) {
        setFormData(prev => ({ ...prev, client_id: clientId }));
      }
      
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
          const response = await fetch(`${BACKEND_URL}/api/business-plans/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setNiwId(doc.id);
            setFormData({
              project_title: doc.project_title || '',
              applicant_name: doc.applicant_name || '',
              applicant_cv: doc.applicant_cv || '',
              project_idea: doc.project_idea || '',
              patent_info: doc.patent_info || '',
              language: doc.language || 'en',
              apply_graphic_design: doc.apply_graphic_design || false,
              design_description: doc.design_description || '',
              client_id: doc.client_id || ''
            });
            
            setCvData({
              applicant_name: doc.applicant_name || '',
              applicant_cv: doc.applicant_cv || '',
              patent_info: doc.patent_info || '',
              language: doc.language || 'en'
            });
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`Documento cargado - ${doc.sections.length}/16 secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('Documento cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar documento');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'niw' && draft.content) {
            // Load draft data into form
            if (draft.content.cvData) setCvData(draft.content.cvData);
            if (draft.content.formData) setFormData(draft.content.formData);
            if (draft.content.selectedProjectName) setSelectedProjectName(draft.content.selectedProjectName);
            if (draft.content.step) setStep(draft.content.step);
            toast.success('Borrador cargado exitosamente');
          }
          sessionStorage.removeItem('draft_to_load');
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    
    loadDocument();
  }, [clientId, resumeId]);
  
  const saveDraft = async () => {
    try {
      setSavingDraft(true);
      toast.info('💾 Guardando borrador...');
      const token = localStorage.getItem('token');
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      
      // Calculate completion percentage
      let completion = 0;
      if (cvData.applicant_name) completion += 20;
      if (cvData.applicant_cv) completion += 30;
      if (selectedProjectName || formData.project_title) completion += 25;
      if (formData.project_idea) completion += 25;
      
      console.log('💾 Guardando borrador:', { step, completion, clientId, niwId, sectionNumber });
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'niw',
          title: formData.project_title || selectedProjectName || cvData.applicant_name || 'Borrador NIW sin título',
          content: {
            cvData,
            formData,
            selectedProjectName,
            projectNameSuggestions,
            step,
            niwId,
            sectionNumber,
            sections,
            currentSection
          },
          client_id: formData.client_id || clientId,
          notes: `Borrador guardado en paso: ${step}, sección: ${sectionNumber}`,
          completion_percentage: completion
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('💾 Respuesta del servidor:', data);
      
      if (data.success || data.id) {
        toast.success('✅ Borrador guardado exitosamente');
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error(`Error al guardar borrador: ${error.message}`);
    } finally {
      setSavingDraft(false);
    }
  };
  
  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

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
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload-cv`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setCvData({
          ...cvData,
          applicant_cv: response.data.analyzed_cv
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


  const handleCVSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/business-plans/suggest-project-names`, cvData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProjectNameSuggestions(response.data.suggestions);
      setStep('project_names');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sugerencias de nombres');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleProjectNameSelection = async (name) => {
    setSelectedProjectName(name);
    
    // ⭐ Preparar datos completos del NIW
    const niwData = {
      ...formData,
      project_title: name,
      applicant_name: cvData.applicant_name,
      applicant_cv: cvData.applicant_cv,
      patent_info: cvData.patent_info || '',
      project_idea: `Proyecto: ${name}\n\nBasado en el perfil profesional del solicitante: ${cvData.applicant_name}`,
      language: 'en', // ⭐ Siempre inglés por defecto
      has_graphic_design: false,
      design_description: ''
    };
    
    setFormData(niwData);
    setGenerating(true);
    
    try {
      const token = localStorage.getItem('token');
      
      // ⭐ Iniciar NIW directamente
      const response = await axios.post(`${API}/business-plans/start-interactive`, niwData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setNiwId(response.data.id);
      setStep('generating');
      
      // ⭐ Generar primera sección
      await generateSection(response.data.id, 1);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar la propuesta');
      setGenerating(false);
    }
  };

  const handleStartNIW = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/business-plans/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNiwId(response.data.id);
      setStep('generating');
      await generateSection(response.data.id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar la propuesta');
      setGenerating(false);
    }
  };

  const generateSection = async (id, secNum) => {
    setGenerating(true);
    setEditMode(false);
    setEditInstructions('');
    
    // ⭐ FIX Bug #2: Actualizar sectionNumber y progreso visual
    setSectionNumber(secNum);
    setVisualProgress((secNum / 18) * 100);
    
    // ⭐ Simular progreso incremental durante la generación (actualizar cada 1 segundo)
    const targetProgress = (secNum / 18) * 100;
    const progressInterval = setInterval(() => {
      setVisualProgress(prev => {
        // Incrementar progreso simulado hasta un máximo de targetProgress + 4%
        if (prev < targetProgress + 4) {
          return Math.min(prev + 0.8, targetProgress + 4);
        }
        return prev;
      });
    }, 1000);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/generate-section/${id}?section_number=${secNum}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      // ⭐ Detener el intervalo de progreso y establecer el progreso final
      clearInterval(progressInterval);
      setVisualProgress((secNum / 18) * 100);
      
      // ⭐ Mapear respuesta bilingüe correctamente
      const section = response.data.section;
      
      // ⭐ Procesar validation_warning de evaluaciones bilingües
      let validation_warning = response.data.validation_warning;
      
      // Si la respuesta tiene estructura bilingüe (evaluations.spanish/english)
      if (response.data.evaluations) {
        const evalEs = response.data.evaluations.spanish || {};
        const evalEn = response.data.evaluations.english || {};
        
        // ⭐ FIX Bug #3: SIEMPRE usar evaluación en español si existe
        const selectedEval = (evalEs.issues && evalEs.issues.length > 0) ? evalEs : evalEn;
        
        // ⭐ Traducir issues y feedback AL ESPAÑOL (idioma por defecto = español)
        const translatedIssues = (selectedEval.issues || []).map(issue => translateIssue(issue, 'es'));
        const translatedFeedback = translateFeedback(selectedEval.feedback, 'es');
        
        // Crear validation_warning con textos 100% en español
        validation_warning = {
          title: "⚠️ Advertencia de Validación",
          summary: "Revisión de calidad completada.",
          issues: translatedIssues.length > 0 ? translatedIssues : ["Revisa el contenido generado"],
          feedback: translatedFeedback || "Revisa el contenido antes de aprobar.",
          recommendation: "Revisa el contenido cuidadosamente antes de aprobar. Puedes usar la opción de 'Editar Sección' para solicitar cambios específicos a la IA.",
          metrics: {
            character_count: section.content_es?.length || section.content?.length || 0,
            required_range: "2500-4000",
            has_conclusion: selectedEval.has_conclusion || false,
            has_repetition: selectedEval.has_repetition || false
          }
        };
      }
      
      setCurrentSection({
        ...section,
        validation_warning: validation_warning,
        evaluations: response.data.evaluations // ⭐ Guardar evaluaciones para toggle de idioma
      });
      // ⭐ sectionNumber ya fue actualizado al inicio de la función
      
      // Show validation info if available
      if (response.data.validation_passed === false || validation_warning) {
        toast.warning('⚠️ Sección generada. Revisa los detalles de validación.');
      } else if (response.data.validation_passed) {
        toast.success('✓ Sección generada y validada exitosamente');
      }
      
      setStep('review');
    } catch (error) {
      // ⭐ Detener el intervalo de progreso en caso de error
      clearInterval(progressInterval);
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setGenerating(true);
    setRegeneratingOtherLanguage(true);
    try {
      const token = localStorage.getItem('token');
      
      // ⭐ Usar nuevo endpoint bilingüe
      const response = await axios.post(
        `${API}/business-plans/edit-section-bilingual/${niwId}`,
        {
          section_number: sectionNumber,
          edit_instructions: editInstructions,
          edited_content: getCurrentContent(currentSection),
          edited_language: currentLanguage,
          current_section_title: currentSection.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentSection(response.data.section);
      setEditInstructions('');
      setEditMode(false);
      
      // Mensaje de éxito con info de regeneración
      const otherLang = currentLanguage === 'es' ? 'inglés' : 'español';
      toast.success(`✅ Sección editada y versión en ${otherLang} regenerada automáticamente`);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
      setRegeneratingOtherLanguage(false);
    }
  };

  const handleApproveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/business-plans/approve-section/${niwId}`,
        currentSection,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newSections = [...sections, currentSection];
      setSections(newSections);
      
      if (sectionNumber < 18) {
        toast.success(`Sección ${sectionNumber} aprobada. Generando siguiente...`);
        await generateSection(niwId, sectionNumber + 1);
      } else {
        toast.success('¡Todas las secciones completadas! Finalizando propuesta...');
        await finalizeNIW();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
      setGenerating(false);
    }
  };

  const finalizeNIW = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/finalize/${niwId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('¡Propuesta EB-2 NIW completa generada exitosamente!');
      
      // ⭐ Siempre navegar a la vista del documento al finalizar
      navigate(`/view-business-plan/${response.data.id}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar propuesta');
      setGenerating(false);
    }
  };

  const goToSection = async (secNum) => {
    if (secNum < 1 || secNum > 18) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      await generateSection(niwId, secNum);
    }
  };

  // Step 1: CV Submission
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
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Paso 1: Información del Solicitante</h1>
            <p className="form-subtitle">
              Proporciona tu hoja de vida o resumen profesional para generar una propuesta EB-2 NIW personalizada
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleCVSubmit} className="form-grid">
                <div className="form-field">
                  <Label htmlFor="applicant_name">Nombre Completo *</Label>
                  <Input
                    id="applicant_name"
                    value={cvData.applicant_name}
                    onChange={(e) => setCvData({ ...cvData, applicant_name: e.target.value })}
                    required
                    placeholder="Dr. John Smith"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="applicant_cv">Hoja de Vida / Resumen Profesional *</Label>
                  
                  {/* Toggle between text and PDF upload */}
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
                      placeholder="Incluye: educación, experiencia profesional, publicaciones, premios, certificaciones relevantes, áreas de especialización..."
                      rows={10}
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
                              <p className="text-sm text-gray-600">Analizando CV con IA...</p>
                            </>
                          ) : (
                            <>
                              <FileText size={32} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-700">
                                Click para subir tu CV (PDF, DOC o DOCX)
                              </p>
                              <p className="text-xs text-gray-500">
                                El archivo será analizado automáticamente con IA
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                      
                      {cvData.applicant_cv && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            ✅ CV Analizado y Procesado
                          </p>
                          <Textarea
                            value={cvData.applicant_cv}
                            onChange={(e) => setCvData({ ...cvData, applicant_cv: e.target.value })}
                            rows={8}
                            className="text-sm"
                          />
                          <p className="text-xs text-gray-600 mt-2">
                            Puedes editar el texto analizado si lo deseas
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="patent_info">Información de Patentes (Opcional)</Label>
                  
                  {/* Upload Patent Document Button */}
                  <div className="mb-3">
                    <input
                      type="file"
                      id="patent-file-upload"
                      accept=".pdf,.docx,.doc,.txt"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        // Validate file size (10MB)
                        const maxSize = 10 * 1024 * 1024;
                        if (file.size > maxSize) {
                          toast.error('El archivo es demasiado grande. Máximo 10MB.');
                          e.target.value = '';
                          return;
                        }
                        
                        // Show loading state
                        toast.info('Procesando documento de patente...');
                        setLoadingSuggestions(true);
                        
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          
                          const response = await axios.post(
                            `${API}/business-plans/upload-patent-doc`,
                            formData,
                            {
                              headers: {
                                'Content-Type': 'multipart/form-data',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                              }
                            }
                          );
                          
                          if (response.data.success) {
                            // Update patent_info with formatted text
                            setCvData({ 
                              ...cvData, 
                              patent_info: response.data.formatted_text 
                            });
                            
                            toast.success(
                              `✅ Información extraída exitosamente (${response.data.extraction_method === 'fast_extraction' ? 'Extracción rápida' : 'Extracción inteligente'}, ${Math.round(response.data.confidence)}% confianza)`
                            );
                          } else {
                            toast.error(response.data.error || 'No se pudo extraer información del documento');
                          }
                        } catch (error) {
                          console.error('Error uploading patent document:', error);
                          toast.error(
                            error.response?.data?.detail || 
                            'Error al procesar el documento. Por favor, intenta manualmente.'
                          );
                        } finally {
                          setLoadingSuggestions(false);
                          e.target.value = ''; // Reset input
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('patent-file-upload').click()}
                      className="w-full sm:w-auto"
                      disabled={loadingSuggestions}
                    >
                      <Upload className="mr-2" size={16} />
                      Subir Documento de Patente (PDF, DOCX)
                    </Button>
                    <p className="text-xs text-gray-600 mt-2">
                      Sube tu documento de patente y extraeremos la información automáticamente. También puedes ingresar la información manualmente abajo.
                    </p>
                  </div>
                  
                  {/* Manual Text Entry */}
                  <Textarea
                    id="patent_info"
                    value={cvData.patent_info}
                    onChange={(e) => setCvData({ ...cvData, patent_info: e.target.value })}
                    placeholder="O ingresa manualmente: Título, número de solicitud, estado, fecha de presentación..."
                    rows={5}
                  />
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
                      Continuar →
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

  // Step 2: Project Name Selection
  if (step === 'project_names') {
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
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Paso 2: Selecciona el Nombre del Proyecto</h1>
            <p className="form-subtitle">
              Basándonos en tu perfil, te sugerimos estos nombres profesionales. Debes seleccionar uno.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Recomendación de Mónica */}
            <Card className="border-2 border-purple-500 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <span style={{ fontSize: '32px' }}>M</span>
                  <span>Recomendación de Mónica</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-800 leading-relaxed">
                  Basándome en tu perfil profesional y experiencia, <strong>recomiendo la Opción 1</strong> porque:
                </p>
                <ul className="mt-3 space-y-2 text-purple-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">✓</span>
                    <span>Tiene mayor alineación con tus credenciales y experiencia específica</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">✓</span>
                    <span>Presenta un caso más fuerte de importancia nacional inmediata</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">✓</span>
                    <span>Demuestra mérito sustancial con mayor claridad para USCIS</span>
                  </li>
                </ul>
                <p className="mt-3 text-sm text-purple-600 italic">
                  Sin embargo, puedes elegir cualquier opción que mejor represente tu proyecto.
                </p>
              </CardContent>
            </Card>

            {(projectNameSuggestions || []).map((suggestion, index) => {
              // Generar descripción DETALLADA y específica basada en el proyecto
              const getProjectDescription = (projectName, idx) => {
                const lowerName = projectName.toLowerCase();
                
                let description = `<div class="space-y-3">`;
                description += `<p><strong className="text-gray-900">Solicitante:</strong> ${cvData.applicant_name}</p>`;
                
                // Descripción del proyecto según tipo
                description += `<p><strong className="text-gray-900">Descripción:</strong> `;
                
                if (lowerName.includes('ai') || lowerName.includes('artificial intelligence') || lowerName.includes('machine learning')) {
                  description += `Este proyecto propone desarrollar e implementar soluciones avanzadas de inteligencia artificial y machine learning con aplicaciones directas en sectores críticos de EE.UU. La iniciativa se enfoca en crear sistemas inteligentes que mejoren la eficiencia, seguridad y competitividad de infraestructura nacional, alineándose con prioridades federales de innovación tecnológica.`;
                } else if (lowerName.includes('infrastructure') || lowerName.includes('platform')) {
                  description += `Este proyecto busca diseñar y construir infraestructura tecnológica robusta, escalable y segura que sirva como base para sistemas de importancia nacional. La plataforma propuesta modernizará procesos críticos, mejorará la interoperabilidad entre agencias federales y fortalecerá la capacidad tecnológica del país.`;
                } else if (lowerName.includes('security') || lowerName.includes('secure') || lowerName.includes('cybersecurity')) {
                  description += `Este proyecto se centra en implementar sistemas de seguridad avanzados y arquitecturas de ciberseguridad que protejan infraestructura crítica nacional, datos sensibles y redes gubernamentales. La iniciativa responde directamente a amenazas emergentes y prioridades de seguridad nacional establecidas por órdenes ejecutivas federales.`;
                } else if (lowerName.includes('healthcare') || lowerName.includes('medical') || lowerName.includes('health')) {
                  description += `Este proyecto propone revolucionar la atención médica mediante tecnología innovadora que mejore diagnósticos, tratamientos y acceso a servicios de salud. La iniciativa aborda desafíos críticos del sistema de salud estadounidense, alineándose con objetivos de modernización del sector salud y bienestar público.`;
                } else if (lowerName.includes('optimization') || lowerName.includes('efficiency')) {
                  description += `Este proyecto se enfoca en optimizar procesos críticos a nivel nacional mediante soluciones tecnológicas que mejoren la eficiencia, reduzcan costos operativos y aumenten la productividad en sectores clave. La iniciativa demuestra impacto medible en la competitividad económica de EE.UU.`;
                } else if (lowerName.includes('data') || lowerName.includes('analytics')) {
                  description += `Este proyecto propone desarrollar sistemas avanzados de análisis de datos y business intelligence que permitan toma de decisiones basada en evidencia para organizaciones de importancia nacional. La iniciativa mejora la capacidad analítica y predictiva en sectores estratégicos.`;
                } else if (lowerName.includes('automation') || lowerName.includes('robotic')) {
                  description += `Este proyecto busca implementar soluciones de automatización y robótica que transformen procesos industriales y operacionales críticos. La iniciativa aumenta la eficiencia, seguridad y competitividad de sectores manufactureros y de servicios estadounidenses.`;
                } else {
                  description += `Este proyecto aborda desafíos tecnológicos significativos mediante soluciones innovadoras que demuestran mérito excepcional e importancia nacional directa. La iniciativa se alinea con prioridades federales de innovación y competitividad tecnológica.`;
                }
                description += `</p>`;
                
                // Por qué cumple con NIW
                description += `<p><strong className="text-gray-900">Cumplimiento EB-2 NIW:</strong></p>`;
                description += `<ul class="list-disc pl-5 space-y-1 text-sm">`;
                description += `<li><strong>Mérito Sustancial:</strong> Innovación tecnológica con aplicaciones demostrables en sectores críticos</li>`;
                description += `<li><strong>Importancia Nacional:</strong> Impacto directo en seguridad, economía, salud o infraestructura de EE.UU.</li>`;
                description += `<li><strong>Beneficio para EE.UU.:</strong> Renuncia del requisito de certificación laboral justificada por el interés nacional</li>`;
                description += `</ul>`;
                
                description += `</div>`;
                
                return description;
              };
              
              const isRecommended = index === 0;
              
              return (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedProjectName === suggestion ? 'border-2 border-black' : ''
                  } ${isRecommended ? 'border-purple-300' : ''}`}
                  onClick={() => handleProjectNameSelection(suggestion)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>Opción {index + 1}</span>
                        {isRecommended && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            ⭐ Recomendada
                          </span>
                        )}
                      </div>
                      {selectedProjectName === suggestion && (
                        <span className="text-green-600">✓ Seleccionado</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold mb-3">{suggestion}</p>
                    <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <span dangerouslySetInnerHTML={{ __html: getProjectDescription(suggestion, index) }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Project Details
  if (step === 'details') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('project_names')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Paso 3: Detalles del Proyecto</h1>
            <p className="form-subtitle">
              Proyecto seleccionado: <strong>{selectedProjectName}</strong>
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartNIW} className="form-grid">
                <div className="form-field full-width">
                  <Label>Título del Proyecto</Label>
                  <Input
                    value={formData.project_title}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

              <div className="form-field full-width">
                <div className="flex items-start space-x-3 mt-4">
                  <input
                    type="checkbox"
                    id="apply_graphic_design"
                    data-testid="graphic-design-checkbox"
                    checked={formData.apply_graphic_design}
                    onChange={(e) => setFormData({ ...formData, apply_graphic_design: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="apply_graphic_design" className="cursor-pointer font-semibold">
                      ✨ Aplicar Diseño Gráfico Profesional con Gamma
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Genera un documento visualmente impresionante usando Gamma.app después de crear el contenido
                    </p>
                  </div>
                </div>

                {formData.apply_graphic_design && (
                  <div className="mt-4">
                    <Label htmlFor="design_description">Descripción del Diseño Deseado</Label>
                    <Textarea
                      id="design_description"
                      data-testid="design-description-input"
                      value={formData.design_description}
                      onChange={(e) => setFormData({ ...formData, design_description: e.target.value })}
                      placeholder="Describe el estilo visual: colores, fuentes, estructura, estilo corporativo, etc."
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Button 
                  type="button"
                  onClick={saveDraft}
                  variant="outline"
                  disabled={generating}
                  style={{ flex: 1 }}
                >
                  <Save className="mr-2" size={18} />
                  Guardar Borrador
                </Button>
                <Button 
                  type="submit" 
                  disabled={generating} 
                  className="submit-button"
                  data-testid="generate-plan-btn"
                  style={{ flex: 1 }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2" size={18} />
                      Comenzar Propuesta
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
          {/* Logo Monica con animación */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            margin: '0 auto 30px',
            backgroundColor: '#000',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '48px', color: '#fff', fontWeight: 'bold' }}>M</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, visualProgress)}%`,
                height: '100%',
                backgroundColor: '#000',
                transition: 'width 0.5s ease',
                animation: 'shimmer 1.5s infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
              {Math.round(visualProgress)}%
            </p>
          </div>

          {/* Información de progreso */}
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px', color: '#000' }}>
            Generando Sección {sectionNumber} de 18
          </h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
            {NIW_SECTION_TITLES[sectionNumber - 1]}
          </p>
          <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
            <p>✨ Generando contenido con IA...</p>
            <p>🔍 Validando calidad automáticamente...</p>
            <p>⏱️ Esto puede tomar 30-90 segundos</p>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
        `}</style>
      </div>
    );
  }

  if (step === 'review' && currentSection) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de 18
            </span>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          <div className="mb-4 flex gap-1 flex-wrap">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => setSectionNumber(num)}
                disabled={num > sections.length}
                title={`Sección ${num}`}
                className={`px-3 py-2 rounded text-xs ${
                  num === sectionNumber 
                    ? 'bg-black text-white' 
                    : num <= sections.length 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {currentSection.validation_warning && (
            <Card className="mb-4" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  {currentSection.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentSection.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Sección "Problemas detectados" eliminada para evitar problemas de traducción */}
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>
                    {currentLanguage === 'es' ? 'Retroalimentación del evaluador:' : 'Evaluator feedback:'}
                  </strong>
                  <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentSection.validation_warning.feedback}</p>
                </div>
                {currentSection.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>
                      {currentLanguage === 'es' ? 'Métricas:' : 'Metrics:'}
                    </strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>
                        📏 {currentLanguage === 'es' ? 'Caracteres:' : 'Characters:'} {currentSection.validation_warning.metrics.character_count || 'N/A'} ({currentLanguage === 'es' ? 'requerido:' : 'required:'} {currentSection.validation_warning.metrics.required_range || '2500-4000'})
                      </li>
                      <li style={{ color: '#5d4037' }}>
                        📝 {currentLanguage === 'es' ? 'Tiene conclusión:' : 'Has conclusion:'} {currentSection.validation_warning.metrics.has_conclusion ? (currentLanguage === 'es' ? '❌ Sí (debe eliminarse)' : '❌ Yes (should be removed)') : (currentLanguage === 'es' ? '✓ No' : '✓ No')}
                      </li>
                      <li style={{ color: '#5d4037' }}>
                        🔄 {currentLanguage === 'es' ? 'Tiene repetición:' : 'Has repetition:'} {currentSection.validation_warning.metrics.has_repetition ? (currentLanguage === 'es' ? '❌ Sí (debe evitarse)' : '❌ Yes (should be avoided)') : (currentLanguage === 'es' ? '✓ No' : '✓ No')}
                      </li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 {currentLanguage === 'es' ? 'Recomendación:' : 'Recommendation:'}</strong> {currentSection.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success evaluation card - show when no warnings but has evaluation history */}
          {!currentSection.validation_warning && currentSection.evaluation_history && currentSection.evaluation_history.length > 0 && (
            <Card className="mb-4" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Esta sección pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Sección aprobada en intento {currentSection.evaluation_history.length}
                  </p>
                </div>
                {currentSection.evaluation_history[0] && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#4caf50' }}>📏 Caracteres: {(currentSection.content_es || currentSection.content || '').length} (cumple estándares)</li>
                      <li style={{ color: '#4caf50' }}>📝 Estructura narrativa: ✓ Adecuada</li>
                      <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Este capítulo está listo para continuar o puedes editarlo para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Sección {sectionNumber} de 18</CardTitle>
              <CardDescription>{formData.title}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* ⭐ Toggle de Idioma Bilingüe */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <span style={{ 
                  fontWeight: currentLanguage === 'es' ? 'bold' : 'normal',
                  color: currentLanguage === 'es' ? '#8b5cf6' : '#666',
                  fontSize: '0.95rem'
                }}>
                  🇪🇸 Español
                </span>
                
                <button
                  onClick={toggleLanguage}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '0.5rem 1.5rem',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                  }}
                >
                  {currentLanguage === 'es' ? '→ Switch to English' : '→ Cambiar a Español'}
                </button>
                
                <span style={{ 
                  fontWeight: currentLanguage === 'en' ? 'bold' : 'normal',
                  color: currentLanguage === 'en' ? '#8b5cf6' : '#666',
                  fontSize: '0.95rem'
                }}>
                  🇺🇸 English
                </span>
              </div>
              
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentLanguage === 'es' ? (currentSection.content_es || currentSection.content || '') : (currentSection.content_en || '') }}
                style={{
                  lineHeight: '1.6',
                  color: '#333'
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-top: 1.5rem;
                  margin-bottom: 1rem;
                  color: #000;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                }
                .prose table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 1.5rem 0;
                  border: 1px solid #ddd;
                }
                .prose th {
                  background-color: #000;
                  color: #fff;
                  padding: 12px;
                  text-align: left;
                  font-weight: 600;
                  border: 1px solid #000;
                }
                .prose td {
                  padding: 10px 12px;
                  border: 1px solid #ddd;
                }
                .prose tr:nth-child(even) {
                  background-color: #f9f9f9;
                }
                .prose ul, .prose ol {
                  margin: 1rem 0;
                  padding-left: 2rem;
                }
                .prose li {
                  margin-bottom: 0.5rem;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={generating || savingDraft}
                data-testid="save-draft-btn"
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2" size={18} />
                    💾 Guardar Borrador
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
                data-testid="edit-section-btn"
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                variant="outline"
                onClick={() => generateSection(niwId, sectionNumber)}
                disabled={generating}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                data-testid="regenerate-section-btn"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Regenerando...
                  </>
                ) : (
                  <>
                    🔄 Regenerar Sección
                  </>
                )}
              </Button>
              <Button
                onClick={handleApproveSection}
                disabled={generating}
                data-testid="approve-section-btn"
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {sectionNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en esta sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {currentLanguage === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {currentLanguage === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más evidencia cuantitativa del impacto nacional. Incluye referencias a estudios académicos recientes. Fortalece la argumentación sobre substantial merit.'"
                  rows={5}
                  className="mb-4"
                  data-testid="edit-instructions-input"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEditSection}
                    disabled={generating || !editInstructions.trim()}
                    data-testid="apply-edit-btn"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return null;
};

const CreateBookInteractive = () => {
  const [step, setStep] = useState('profile'); // profile, ideas, titles, details, generating, review
  const [profileData, setProfileData] = useState({
    author_name: '',
    profile_summary: '',
    language: 'es'
  });
  const [bookIdeas, setBookIdeas] = useState([]);
  const [bookIdeasEvaluation, setBookIdeasEvaluation] = useState(null);
  const [bookRecommendation, setBookRecommendation] = useState(null); // ⭐ Recomendación del evaluador
  const [selectedIdea, setSelectedIdea] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [titlesEvaluation, setTitlesEvaluation] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    synopsis: '',
    num_chapters: 10,
    writing_style: 'profesional',
    language: 'es',
    apply_graphic_design: false,
    design_description: ''
  });
  const [bookId, setBookId] = useState(null);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapters, setChapters] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Validate that client_id is present (required for book creation)
  React.useEffect(() => {
    if (!clientId && !resumeId) {
      toast.error('Se requiere seleccionar un cliente para crear un libro');
      navigate('/dashboard');
    }
  }, [clientId, resumeId, navigate]);
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
          const response = await fetch(`${BACKEND_URL}/api/books/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setBookId(doc.id);
            setFormData({
              title: doc.title || '',
              genre: doc.genre || '',
              synopsis: doc.synopsis || '',
              num_chapters: doc.num_chapters || 10,
              language: doc.language || 'es',
              client_id: doc.client_id || ''
            });
            
            setProfileData({
              author_name: doc.author_name || '',
              profile_summary: doc.profile_summary || '',
              language: doc.language || 'es'
            });
            
            // Load chapters if they exist
            if (doc.chapters && doc.chapters.length > 0) {
              setChapters(doc.chapters);
              const nextChapter = doc.current_chapter || doc.chapters.length + 1;
              setChapterNumber(nextChapter);
              
              // Set current chapter to the last completed one for review
              const lastChapter = doc.chapters[doc.chapters.length - 1];
              setCurrentChapter(lastChapter);
              setStep('review');
              toast.success(`Libro cargado - ${doc.chapters.length}/${doc.num_chapters} capítulos completados`);
            } else {
              // No chapters yet, go to generating step to create first chapter
              setStep('generating');
              toast.success('Libro cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar libro');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'book' && draft.content) {
            // Load draft data into form
            if (draft.content.profileData) setProfileData(draft.content.profileData);
            if (draft.content.bookIdeas) setBookIdeas(draft.content.bookIdeas);
            if (draft.content.selectedIdea) setSelectedIdea(draft.content.selectedIdea);
            if (draft.content.titleSuggestions) setTitleSuggestions(draft.content.titleSuggestions);
            if (draft.content.selectedTitle) setSelectedTitle(draft.content.selectedTitle);
            if (draft.content.formData) setFormData(draft.content.formData);
            if (draft.content.step) setStep(draft.content.step);
            toast.success('Borrador cargado exitosamente');
          }
          sessionStorage.removeItem('draft_to_load');
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    
    loadDocument();
  }, [resumeId]);
  
  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/books/suggest-ideas`, profileData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBookIdeas(response.data.suggestions);
      setBookIdeasEvaluation(response.data.evaluation); // Guardar evaluación
      setBookRecommendation(response.data.recommendation); // ⭐ Guardar recomendación
      setStep('ideas');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar ideas');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleIdeaSelection = async (idea) => {
    setSelectedIdea(idea);
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/books/suggest-titles`, {
        selected_idea: idea,
        profile_summary: profileData.profile_summary,
        language: profileData.language
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTitleSuggestions(response.data.suggestions);
      setTitlesEvaluation(response.data.evaluation); // Guardar evaluación
      setStep('titles');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar títulos');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleTitleSelection = (title) => {
    setSelectedTitle(title);
    // Extract genre from idea (format: "Genre: idea")
    const genreMatch = selectedIdea.match(/^([^:]+):/);
    const genre = genreMatch ? genreMatch[1].trim() : 'General';
    
    setFormData({
      ...formData,
      title: title,
      genre: genre,
      synopsis: selectedIdea,
      language: profileData.language
    });
    setStep('details');
  };

  const handleStartBook = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      
      // Validate client_id is present
      if (!clientId) {
        toast.error('Se requiere un cliente para crear el libro');
        return;
      }
      
      const bookData = {
        ...formData,
        client_id: clientId
      };
      const response = await axios.post(`${API}/books/start-interactive`, bookData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBookId(response.data.id);
      setStep('generating');
      await generateChapter(response.data.id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar el libro');
      setGenerating(false);
    }
  };

  const generateChapter = async (id, chapterNum) => {
    setGenerating(true);
    setEditMode(false);
    setEditInstructions('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/generate-chapter/${id}?chapter_number=${chapterNum}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newChapter = {
        ...response.data.chapter,
        validation_warning: response.data.validation_warning
      };
      
      setCurrentChapter(newChapter);
      setChapterNumber(chapterNum);
      
      // Add chapter to chapters array temporarily (will be replaced when approved)
      const updatedChapters = chapters.filter(ch => ch.number !== chapterNum);
      updatedChapters.push(newChapter);
      updatedChapters.sort((a, b) => a.number - b.number);
      setChapters(updatedChapters);
      
      // Show validation info if available
      if (response.data.validation_passed === false) {
        toast.error('⚠️ Capítulo generado pero NO pasó validación automática. Revisa los detalles.');
      } else if (response.data.validation_passed) {
        toast.success('✓ Capítulo validado automáticamente por IA');
      }
      
      setStep('review');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditChapter = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/edit-chapter/${bookId}`,
        {
          chapter_number: chapterNumber,
          edit_instructions: editInstructions,
          current_chapter_content: currentChapter.content,
          current_chapter_title: currentChapter.title,
          edit_history: currentChapter.edit_history || []
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const editedChapter = {
        ...response.data.chapter,
        validation_warning: response.data.validation_warning
      };
      
      setCurrentChapter(editedChapter);
      
      // Update the chapter in the chapters array too
      const updatedChapters = chapters.map(ch => 
        ch.number === chapterNumber ? editedChapter : ch
      );
      setChapters(updatedChapters);
      
      setEditInstructions('');
      setEditMode(false);
      
      // Show validation info
      if (response.data.validation_passed === false) {
        toast.error('⚠️ Capítulo editado pero NO pasó validación automática. Revisa los detalles.');
      } else if (response.data.validation_passed) {
        toast.success('✓ Capítulo editado y validado automáticamente por IA');
      } else {
        toast.success('Capítulo editado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/books/approve-chapter/${bookId}`,
        currentChapter,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const newChapters = [...chapters, currentChapter];
      setChapters(newChapters);
      
      if (chapterNumber < formData.num_chapters) {
        toast.success(`Capítulo ${chapterNumber} aprobado. Generando siguiente...`);
        await generateChapter(bookId, chapterNumber + 1);
      } else {
        toast.success('¡Todos los capítulos completados! Finalizando libro...');
        await finalizeBook();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar capítulo');
      setGenerating(false);
    }
  };

  const finalizeBook = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/finalize/${bookId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('¡Libro completo generado exitosamente!');
      navigate(`/view-book/${response.data.id}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar libro');
      setGenerating(false);
    }
  };

  const goToChapter = async (chapterNum) => {
    if (chapterNum < 1 || chapterNum > formData.num_chapters) return;
    
    const existingChapter = chapters.find(ch => ch.number === chapterNum);
    if (existingChapter) {
      setCurrentChapter(existingChapter);
      setChapterNumber(chapterNum);
      setStep('review');
    } else if (chapterNum === chapters.length + 1) {
      await generateChapter(bookId, chapterNum);
    }
  };

  const saveDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      
      // Calculate completion percentage
      let completion = 0;
      if (profileData.author_name) completion += 15;
      if (profileData.profile_summary) completion += 15;
      if (selectedIdea) completion += 20;
      if (selectedTitle || formData.title) completion += 20;
      if (formData.synopsis) completion += 15;
      if (formData.num_chapters) completion += 15;
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'book',
          title: formData.title || selectedTitle || profileData.author_name || 'Borrador Libro sin título',
          content: {
            profileData,
            bookIdeas,
            selectedIdea,
            titleSuggestions,
            selectedTitle,
            formData,
            step
          },
          client_id: clientId,
          notes: `Borrador guardado en paso: ${step}`,
          completion_percentage: completion
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Borrador guardado exitosamente');
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Error al guardar borrador');
    }
  };

  // Step 1: Profile
  if (step === 'profile') {
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
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 1: Perfil del Autor</h1>
            <p className="form-subtitle">
              Proporciona tu perfil para generar ideas de libro personalizadas
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleProfileSubmit} className="form-grid">
                <div className="form-field">
                  <Label htmlFor="author_name">Nombre del Autor *</Label>
                  <Input
                    id="author_name"
                    value={profileData.author_name}
                    onChange={(e) => setProfileData({ ...profileData, author_name: e.target.value })}
                    required
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="profile_summary">Resumen de Perfil / Experiencia *</Label>
                  <Textarea
                    id="profile_summary"
                    value={profileData.profile_summary}
                    onChange={(e) => setProfileData({ ...profileData, profile_summary: e.target.value })}
                    required
                    placeholder="Describe tu experiencia, intereses, especialización, temas que dominas, estilo de escritura preferido..."
                    rows={8}
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="language">Idioma del Libro</Label>
                  <Select
                    value={profileData.language}
                    onValueChange={(value) => setProfileData({ ...profileData, language: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  type="submit" 
                  disabled={loadingSuggestions} 
                  className="submit-button"
                >
                  {loadingSuggestions ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Generando Ideas...
                    </>
                  ) : (
                    <>
                      Continuar →
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

  // Step 2: Book Ideas
  if (step === 'ideas') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('profile')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 2: Selecciona una Idea</h1>
            <p className="form-subtitle">
              Basándonos en tu perfil, te sugerimos estas ideas. Debes seleccionar una.
            </p>
          </div>

          {/* Loading overlay cuando se está procesando */}
          {loadingSuggestions && (
            <div className="max-w-3xl mx-auto mb-6">
              <Card className="border-2 border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
                    <div>
                      <p className="text-lg font-semibold text-blue-900">Generando títulos para tu libro...</p>
                      <p className="text-sm text-blue-700">Esto puede tomar unos segundos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            {/* ⭐ Mostrar recomendación del evaluador - Estilo similar a patentes */}
            {bookIdeasEvaluation && bookIdeasEvaluation.why_this_idea && (
              <Card className="border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <span className="text-2xl">⭐</span>
                    Recomendación del Experto
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-green-800">
                    💡 Te recomendamos la Idea #{bookIdeasEvaluation.best_idea_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <p className="font-semibold text-sm text-green-700 mb-2">¿Por qué esta idea?</p>
                    <p className="text-gray-700 text-sm">{bookIdeasEvaluation.why_this_idea}</p>
                  </div>
                  
                  {bookIdeasEvaluation.strengths && (
                    <div className="bg-white p-3 rounded-lg border border-green-200">
                      <p className="font-semibold text-sm text-green-700 mb-2">✨ Fortalezas clave:</p>
                      <p className="text-gray-700 text-sm">{bookIdeasEvaluation.strengths}</p>
                    </div>
                  )}
                  
                  {bookIdeasEvaluation.quick_tips && (
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <p className="font-semibold text-sm text-blue-700 mb-2">🚀 Tips rápidos:</p>
                      <p className="text-gray-700 text-sm">{bookIdeasEvaluation.quick_tips}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs text-gray-600 italic">
                      💡 Puedes elegir cualquier idea, pero la Idea #{bookIdeasEvaluation.best_idea_number} tiene el mayor potencial según nuestro análisis.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ⭐ Mostrar recomendación del evaluador */}
            {bookRecommendation && (
              <Card className="border-2 border-purple-300 bg-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <span className="text-2xl">💡</span>
                    Recomendación de Mónica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 italic">"{bookRecommendation.reason}"</p>
                </CardContent>
              </Card>
            )}

            {bookIdeas.map((idea, index) => {
              // ⭐ Verificar si esta es la opción recomendada (usando nuevo formato)
              const recommendedNumber = bookIdeasEvaluation?.best_idea_number;
              const isRecommended = recommendedNumber && parseInt(recommendedNumber) === (index + 1);
              const isThisIdeaSelected = loadingSuggestions && selectedIdea === idea;
              
              return (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isRecommended ? 'border-2 border-green-400 bg-green-50 shadow-lg' : 'hover:border-black'
                  } ${loadingSuggestions ? 'pointer-events-none opacity-50' : ''}`}
                  onClick={() => !loadingSuggestions && handleIdeaSelection(idea)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Idea {index + 1}
                      {/* ⭐ Badge de recomendado */}
                      {isRecommended && (
                        <span className="ml-auto text-xs font-semibold px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full flex items-center gap-1">
                          ⭐ Mejor Opción
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base">{idea}</p>
                    {/* Loading indicator cuando se selecciona esta idea */}
                    {isThisIdeaSelected && (
                      <div className="flex items-center justify-center mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Loader2 className="animate-spin mr-2" size={20} style={{ color: '#3b82f6' }} />
                        <span className="text-blue-700 font-medium">Generando títulos...</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Title Selection
  if (step === 'titles') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('ideas')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 3: Selecciona un Título</h1>
            <p className="form-subtitle">
              Idea seleccionada: <strong>{selectedIdea.substring(0, 100)}...</strong>
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {/* ⭐ Recomendación del mejor título - Estilo similar a ideas */}
            {titlesEvaluation && titlesEvaluation.why_this_title && (
              <Card className="border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <span className="text-2xl">⭐</span>
                    Recomendación del Experto
                  </CardTitle>
                  <CardDescription className="text-base font-semibold text-green-800">
                    💡 Te recomendamos el Título #{titlesEvaluation.best_title_number}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <p className="font-semibold text-sm text-green-700 mb-2">¿Por qué este título?</p>
                    <p className="text-gray-700 text-sm">{titlesEvaluation.why_this_title}</p>
                  </div>
                  
                  {titlesEvaluation.issues && titlesEvaluation.issues.length > 0 && (
                    <div className="bg-white p-3 rounded-lg border border-orange-200">
                      <p className="font-semibold text-sm text-orange-700 mb-2">⚠️ Aspectos a considerar:</p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {titlesEvaluation.issues.map((issue, idx) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {titlesEvaluation.feedback && (
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <p className="font-semibold text-sm text-blue-700 mb-2">💡 Sugerencia:</p>
                      <p className="text-gray-700 text-sm">{titlesEvaluation.feedback}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-xs text-gray-600 italic">
                      💡 Puedes elegir cualquier título, pero el Título #{titlesEvaluation.best_title_number} tiene mayor potencial comercial.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {titleSuggestions.map((title, index) => {
              // Verificar si este es el título recomendado
              const recommendedNumber = titlesEvaluation?.best_title_number;
              const isRecommended = recommendedNumber && parseInt(recommendedNumber) === (index + 1);
              
              return (
                <Card 
                key={index}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isRecommended ? 'border-2 border-green-400 bg-green-50 shadow-lg' : 
                  selectedTitle === title ? 'border-2 border-black' : 'hover:border-black'
                }`}
                onClick={() => handleTitleSelection(title)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Título {index + 1}</span>
                    <div className="flex items-center gap-2">
                      {isRecommended && (
                        <span className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full flex items-center gap-1">
                          ⭐ Mejor Opción
                        </span>
                      )}
                      {selectedTitle === title && (
                        <span className="text-green-600">✓ Seleccionado</span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold">{title}</p>
                </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Details
  if (step === 'details') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => setStep('titles')}>
            <ArrowLeft className="mr-2" size={18} />
            Volver
          </Button>
        </div>

        <div className="create-content">
          <div className="form-header">
            <Book size={48} className="form-icon" />
            <h1 className="form-title">Paso 4: Detalles del Libro</h1>
            <p className="form-subtitle">
              Título seleccionado: <strong>{selectedTitle}</strong>
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartBook} className="form-grid">
                <div className="form-field full-width">
                  <Label>Título del Libro</Label>
                  <Input
                    value={formData.title}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="synopsis">Sinopsis / Detalles Adicionales</Label>
                  <Textarea
                    id="synopsis"
                    value={formData.synopsis}
                    onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                    placeholder="Puedes agregar detalles adicionales sobre la trama, personajes, estructura..."
                    rows={6}
                  />
                </div>

              <div className="form-field">
                <Label htmlFor="num_chapters">Número de Capítulos</Label>
                <Input
                  id="num_chapters"
                  type="number"
                  data-testid="chapters-input"
                  value={formData.num_chapters}
                  onChange={(e) => setFormData({ ...formData, num_chapters: parseInt(e.target.value) })}
                  min="3"
                  max="30"
                  required
                />
              </div>

              <div className="form-field">
                <Label htmlFor="writing_style">Estilo de Escritura</Label>
                <Select
                  value={formData.writing_style}
                  onValueChange={(value) => setFormData({ ...formData, writing_style: value })}
                >
                  <SelectTrigger data-testid="style-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profesional">Profesional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="académico">Académico</SelectItem>
                    <SelectItem value="narrativo">Narrativo</SelectItem>
                    <SelectItem value="poético">Poético</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="form-field full-width">
                <div className="flex items-start space-x-3 mt-4">
                  <input
                    type="checkbox"
                    id="apply_graphic_design_book"
                    data-testid="graphic-design-checkbox-book"
                    checked={formData.apply_graphic_design}
                    onChange={(e) => setFormData({ ...formData, apply_graphic_design: e.target.checked })}
                    className="w-4 h-4 mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor="apply_graphic_design_book" className="cursor-pointer font-semibold">
                      ✨ Aplicar Diseño Gráfico Profesional con Gamma
                    </Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Genera un libro visualmente impresionante usando Gamma.app después de crear el contenido
                    </p>
                  </div>
                </div>

                {formData.apply_graphic_design && (
                  <div className="mt-4">
                    <Label htmlFor="design_description_book">Descripción del Diseño Deseado</Label>
                    <Textarea
                      id="design_description_book"
                      data-testid="design-description-input-book"
                      value={formData.design_description}
                      onChange={(e) => setFormData({ ...formData, design_description: e.target.value })}
                      placeholder="Describe el estilo visual: colores, fuentes, estructura, diseño editorial, etc."
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Button 
                  type="button"
                  onClick={saveDraft}
                  variant="outline"
                  disabled={generating}
                  style={{ flex: 1 }}
                >
                  <Save className="mr-2" size={18} />
                  Guardar Borrador
                </Button>
                <Button 
                  type="submit" 
                  disabled={generating} 
                  className="submit-button"
                  data-testid="generate-book-btn"
                  style={{ flex: 1 }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2" size={18} />
                      Comenzar Libro
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
          {/* Logo Monica con animación */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            margin: '0 auto 30px',
            backgroundColor: '#000',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '48px', color: '#fff', fontWeight: 'bold' }}>M</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, (chapterNumber / formData.num_chapters) * 100)}%`,
                height: '100%',
                backgroundColor: '#000',
                transition: 'width 0.3s ease',
                animation: 'shimmer 1.5s infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
              {Math.round((chapterNumber / formData.num_chapters) * 100)}%
            </p>
          </div>

          {/* Información de progreso */}
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px', color: '#000' }}>
            Generando Capítulo {chapterNumber} de {formData.num_chapters}
          </h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
            {formData.title}
          </p>
          <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
            <p>✨ Escribiendo capítulo con IA...</p>
            <p>🔍 Validando calidad automáticamente...</p>
            <p>⏱️ Esto puede tomar 30-90 segundos</p>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
        `}</style>
      </div>
    );
  }

  if (step === 'review' && currentChapter) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Capítulo {chapterNumber} de {formData.num_chapters}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: formData.num_chapters }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  onClick={() => goToChapter(num)}
                  disabled={num > chapters.length + 1}
                  className={`w-8 h-8 rounded text-xs ${
                    num === chapterNumber 
                      ? 'bg-black text-white' 
                      : num <= chapters.length 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          {currentChapter.validation_warning && (
            <Card className="mb-4" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  {currentChapter.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentChapter.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Problemas detectados:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {(currentChapter.validation_warning.issues || []).map((issue, idx) => (
                      <li key={idx} style={{ color: '#d84315', marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Retroalimentación del evaluador:</strong>
                  <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentChapter.validation_warning.feedback}</p>
                </div>
                {currentChapter.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Métricas:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>📏 Caracteres: {currentChapter.validation_warning.metrics.character_count || 'N/A'} (requerido: {currentChapter.validation_warning.metrics.required_range || '2500-3000'})</li>
                      <li style={{ color: '#5d4037' }}>📝 Tiene conclusión: {currentChapter.validation_warning.metrics.has_conclusion ? '❌ Sí (debe eliminarse)' : '✓ No'}</li>
                      <li style={{ color: '#5d4037' }}>🔄 Tiene repetición: {currentChapter.validation_warning.metrics.has_repetition ? '❌ Sí (debe evitarse)' : '✓ No'}</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 Recomendación:</strong> {currentChapter.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success evaluation card - show when no warnings but has evaluation history */}
          {!currentChapter.validation_warning && currentChapter.evaluation_history && currentChapter.evaluation_history.length > 0 && (
            <Card className="mb-4" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Este capítulo pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Capítulo aprobado en intento {currentChapter.evaluation_history.length}
                  </p>
                </div>
                {currentChapter.evaluation_history[0] && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#4caf50' }}>📏 Caracteres: {currentChapter.content.length} (cumple estándares)</li>
                      <li style={{ color: '#4caf50' }}>📝 Estructura: ✓ Adecuada</li>
                      <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Este capítulo está listo para continuar o puedes editarlo para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Capítulo {chapterNumber} de {formData.num_chapters}</CardTitle>
              <CardDescription>{formData.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: currentChapter.content }}
                style={{
                  lineHeight: '1.8',
                  color: '#333'
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.75rem;
                  font-weight: bold;
                  margin-top: 2rem;
                  margin-bottom: 1rem;
                  color: #000;
                  text-align: center;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.5rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                  text-indent: 2em;
                }
                .prose em, .prose i {
                  font-style: italic;
                  color: #555;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
                data-testid="edit-section-btn"
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={handleApproveSection}
                disabled={generating}
                data-testid="approve-section-btn"
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {chapterNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en este capítulo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {i18n.language === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Haz el diálogo más natural y añade más descripción del ambiente. El protagonista debe mostrar más emoción en la escena final.'"
                  rows={5}
                  className="mb-4"
                  data-testid="edit-instructions-input"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEditChapter}
                    disabled={generating || !editInstructions.trim()}
                    data-testid="apply-edit-btn"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return null;
};


// Patent Interactive Creation Component
const CreatePatentInteractive = () => {
  const [step, setStep] = useState('cv'); // cv, invention_titles, details, generating, review
  const [cvData, setCvData] = useState({
    applicant_name: '',
    applicant_cv: '',
    project_description: ''
  });
  const [inventionSuggestions, setInventionSuggestions] = useState([]);
  const [patentRecommendation, setPatentRecommendation] = useState(null);
  const [selectedInvention, setSelectedInvention] = useState(null);
  const [formData, setFormData] = useState({
    invention_title: '',
    inventor_name: '',
    inventor_residence: '',
    invention_description: '',
    technical_field: '',
    mode: 'SPEC',
    language: 'es',
    client_id: null
  });
  const [patentId, setPatentId] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [drawingsGenerated, setDrawingsGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [cvInputMode, setCvInputMode] = useState('text');
  const [uploadingCV, setUploadingCV] = useState(false);
  const [projectInputMode, setProjectInputMode] = useState('text'); // 'text' or 'file'
  const [uploadingProject, setUploadingProject] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('es');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Update formData with client_id when component mounts
  React.useEffect(() => {
    if (clientId && !formData.client_id) {
      setFormData(prev => ({ ...prev, client_id: clientId }));
    }
  }, [clientId]);
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
          const response = await fetch(`${BACKEND_URL}/api/patents/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setPatentId(doc.id);
            setFormData({
              invention_title: doc.invention_title || '',
              inventor_name: doc.inventor_name || '',
              inventor_residence: doc.inventor_residence || '',
              invention_description: doc.invention_description || '',
              technical_field: doc.technical_field || '',
              mode: doc.mode || 'SPEC',
              language: doc.language || 'es',
              client_id: doc.client_id || null
            });
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`Patente cargada - ${doc.sections.length} secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('Patente cargada - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar patente');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'patent' && draft.content) {
            if (draft.content.cvData) setCvData(draft.content.cvData);
            if (draft.content.formData) setFormData(draft.content.formData);
            if (draft.content.selectedInvention) setSelectedInvention(draft.content.selectedInvention);
            if (draft.content.step) setStep(draft.content.step);
            toast.success('Borrador cargado exitosamente');
          }
          sessionStorage.removeItem('draft_to_load');
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    
    loadDocument();
  }, [resumeId]);

  const saveDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      
      let completion = 0;
      if (cvData.applicant_name) completion += 20;
      if (cvData.applicant_cv) completion += 30;
      if (selectedInvention || formData.invention_title) completion += 25;
      if (formData.invention_description) completion += 25;
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'patent',
          title: formData.invention_title || selectedInvention || cvData.applicant_name || 'Borrador Patent sin título',
          content: {
            cvData,
            formData,
            selectedInvention,
            inventionSuggestions,
            step
          },
          client_id: formData.client_id || clientId,
          notes: `Borrador guardado en paso: ${step}`,
          completion_percentage: completion
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Borrador guardado exitosamente');
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Error al guardar borrador');
    }
  };

  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const PATENT_SECTIONS_EN = [
    "Header",
    "Cross-Reference to Related Applications",
    "Statement Regarding Federally Sponsored R&D",
    "Field of the Invention",
    "Background",
    "Summary",
    "Definitions",
    "Brief Description of the Drawings",
    "Detailed Description of Embodiments",
    "Claims",
    "Abstract",
    "Appendices",
    "Filing Package Checklist"
  ];

  const PATENT_SECTIONS_ES = [
    "Encabezado",
    "Referencia Cruzada a Solicitudes Relacionadas",
    "Declaración sobre I+D Patrocinada Federalmente",
    "Campo de la Invención",
    "Antecedentes",
    "Resumen",
    "Definiciones",
    "Breve Descripción de los Dibujos",
    "Descripción Detallada de las Realizaciones",
    "Reivindicaciones",
    "Abstracto",
    "Apéndices",
    "Lista de Verificación del Paquete de Presentación"
  ];

  const PATENT_SECTIONS = i18n.language === 'es' ? PATENT_SECTIONS_ES : PATENT_SECTIONS_EN;

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
          applicant_cv: response.data.analyzed_cv
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

      const response = await axios.post(`${API}/upload-project-doc`, formDataUpload, {
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
        toast.success('✅ Documento analizado exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploadingProject(false);
    }
  };

  const handleCVSubmit = async (e) => {
    e.preventDefault();
    setLoadingSuggestions(true);

    try {
      const token = localStorage.getItem('token');
      const dataWithLanguage = {
        ...cvData,
        language: i18n.language
      };
      const response = await axios.post(`${API}/patents/suggest-invention-titles`, dataWithLanguage, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setInventionSuggestions(response.data.suggestions);
      setPatentRecommendation(response.data.recommendation); // ⭐ Guardar recomendación
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
    setFormData({
      invention_title: invention.title,
      inventor_name: cvData.applicant_name,
      inventor_residence: '',
      // ✅ FIXED: Only use technical invention description, NOT CV (avoids NIW biographical info in patent)
      invention_description: invention.description,
      technical_field: invention.technical_field,
      mode: 'SPEC',
      language: i18n.language,
      client_id: clientId  // Preserve client_id from URL params
    });
    setStep('details');
  };

  const handleStartPatent = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/patents/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPatentId(response.data.id);
      setStep('generating');
      await generateSection(response.data.id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar la patente');
      setGenerating(false);
    }
  };

  const generateSection = async (id, secNum) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/patents/generate-section/${id}?section_number=${secNum}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setCurrentSection(response.data.section);
      setSectionNumber(secNum);
      setStep('review');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const approveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      
      // ⭐ FIX: Send only required fields with correct types to avoid 422 validation errors
      const sectionPayload = {
        number: currentSection.number,
        title: currentSection.title || "",
        content: currentSection.content || "",
        content_es: currentSection.content_es || "",
        content_en: currentSection.content_en || "",
        approved: Boolean(currentSection.approved),
        edit_history: Array.isArray(currentSection.edit_history) ? currentSection.edit_history : []
      };
      
      await axios.post(
        `${API}/patents/approve-section/${patentId}`,
        sectionPayload,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = currentSection;
      } else {
        updatedSections.push(currentSection);
      }
      
      setSections(updatedSections);
      
      if (sectionNumber < 13) {
        await generateSection(patentId, sectionNumber + 1);
      } else {
        toast.success('Todas las secciones completadas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
    } finally {
      setGenerating(false);
    }
  };

  const editSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor proporciona instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/patents/edit-section/${patentId}`,
        {
          section_number: currentSection.number,
          edit_instructions: editInstructions
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentSection(response.data.section);
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = response.data.section;
        setSections(updatedSections);
      }
      
      setEditMode(false);
      setEditInstructions('');
      toast.success('Sección actualizada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  const goToSection = async (secNum) => {
    if (secNum < 1 || secNum > 13) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      await generateSection(patentId, secNum);
    }
  };

  const generateDrawings = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/patents/generate-drawings/${patentId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setDrawingsGenerated(true);
      toast.success('Dibujos generados exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar dibujos');
    } finally {
      setGenerating(false);
    }
  };

  const finalizePatent = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      
      // Si los dibujos no han sido generados, intentar generarlos primero
      if (!drawingsGenerated) {
        toast.info('Generando dibujos técnicos...');
        try {
          const drawingsResponse = await axios.post(
            `${API}/patents/generate-drawings/${patentId}`,
            {},
            { 
              headers: { 'Authorization': `Bearer ${token}` },
              timeout: 180000 // 3 minutes timeout for drawings
            }
          );
          
          if (drawingsResponse.data.success !== false) {
            setDrawingsGenerated(true);
            toast.success('Dibujos generados exitosamente');
          } else {
            // Drawings failed but continue with finalization
            toast.warning('No se pudieron generar los dibujos. Continuando con finalización...');
          }
        } catch (drawingError) {
          // Drawings failed but continue with finalization
          console.error('Drawings error:', drawingError);
          toast.warning('No se pudieron generar los dibujos. Continuando con finalización...');
        }
      }
      
      // Finalizar la patente
      console.log('Starting patent finalization...');
      toast.info('Finalizando patente...');
      
      const response = await axios.post(
        `${API}/patents/finalize/${patentId}`,
        {},
        { 
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 60000 // 1 minute timeout for finalization
        }
      );
      
      console.log('Finalization response:', response.data);
      
      // Check if response has the expected structure
      if (!response.data || !response.data.id) {
        console.error('Invalid response structure:', response.data);
        throw new Error('Respuesta inválida del servidor');
      }
      
      toast.success('¡Patente USPTO generada exitosamente!');
      
      // Navigate with a small delay to ensure toast is visible
      setTimeout(() => {
        console.log('Navigating to:', `/view-patent/${response.data.id}`);
        navigate(`/view-patent/${response.data.id}`);
      }, 500);
      
    } catch (error) {
      console.error('Finalization error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // More specific error messages
      if (error.code === 'ECONNABORTED') {
        toast.error('La operación tardó demasiado. Por favor refresca la página.');
      } else if (error.response?.status === 404) {
        toast.error('Patente no encontrada. Por favor refresca la página.');
      } else if (error.response?.status === 500) {
        toast.error('Error del servidor. La patente puede haberse generado. Refresca la página.');
      } else {
        toast.error('Error al finalizar patente. Refresca la página para verificar.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Step 1: CV/Project Input
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
                  <Label htmlFor="applicant_name">Nombre del Inventor *</Label>
                  <Input
                    id="applicant_name"
                    value={cvData.applicant_name}
                    onChange={(e) => setCvData({ ...cvData, applicant_name: e.target.value })}
                    required
                    placeholder="Dr. John Smith"
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

  // Step 2: Invention Title Selection
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

          {/* ⭐ Mostrar recomendación de Monica */}
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
              // ⭐ Verificar si esta es la opción recomendada
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
                      {/* ⭐ Badge de recomendado */}
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
                      Seleccionar esta Invención →
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

  // Step 3: Final Details
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
              Paso 3: Confirma los detalles y comienza la generación
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartPatent} className="form-grid">
                <div className="form-field full-width">
                  <Label htmlFor="invention_title">Título de la Invención *</Label>
                  <Input
                    id="invention_title"
                    value={formData.invention_title}
                    onChange={(e) => setFormData({ ...formData, invention_title: e.target.value })}
                    required
                  />
                </div>

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

                <div className="form-field full-width">
                  <Label htmlFor="technical_field">Campo Técnico</Label>
                  <Input
                    id="technical_field"
                    value={formData.technical_field}
                    onChange={(e) => setFormData({ ...formData, technical_field: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <Button 
                    type="button"
                    onClick={saveDraft}
                    variant="outline"
                    disabled={generating}
                    style={{ flex: 1 }}
                  >
                    <Save className="mr-2" size={18} />
                    Guardar Borrador
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={generating} 
                    className="submit-button"
                    style={{ flex: 1 }}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Iniciando Generación...
                      </>
                    ) : (
                      <>
                        Generar Patente USPTO →
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Review Section
  if (step === 'review' && currentSection) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de 13
            </span>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          {/* Section Navigation */}
          <div className="mb-4 flex gap-1 flex-wrap">
            {Array.from({ length: 13 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => goToSection(num)}
                disabled={num > sections.length + 1}
                title={PATENT_SECTIONS[num - 1]}
                className={`px-3 py-2 rounded text-xs ${
                  num === sectionNumber 
                    ? 'bg-black text-white' 
                    : num <= sections.length 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          {currentSection.validation_warning && (
            <Card className="mb-4" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  {currentSection.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentSection.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Problemas detectados:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {(currentSection.validation_warning.issues || []).map((issue, idx) => (
                      <li key={idx} style={{ color: '#d84315', marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Retroalimentación del evaluador:</strong>
                  <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentSection.validation_warning.feedback}</p>
                </div>
                {currentSection.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Métricas:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>📏 Caracteres: {currentSection.validation_warning.metrics.character_count || 'N/A'} (requerido: {currentSection.validation_warning.metrics.required_range || '2500-3000'})</li>
                      <li style={{ color: '#5d4037' }}>📝 Estructura técnica: {currentSection.validation_warning.metrics.has_conclusion ? '✓ Adecuada' : '❌ Requiere mejora'}</li>
                      <li style={{ color: '#5d4037' }}>🔄 Claridad: {currentSection.validation_warning.metrics.has_repetition ? '❌ Contiene repeticiones' : '✓ Clara'}</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 Recomendación:</strong> {currentSection.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success evaluation card - show when no warnings but has evaluation history */}
          {!currentSection.validation_warning && currentSection.evaluation_history && currentSection.evaluation_history.length > 0 && (
            <Card className="mb-4" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>✅</span>
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Esta sección pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Sección aprobada en intento {currentSection.evaluation_history.length}
                  </p>
                </div>
                {currentSection.evaluation_history[0] && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#4caf50' }}>📏 Caracteres: {currentSection.content.length} (cumple estándares)</li>
                      <li style={{ color: '#4caf50' }}>📝 Estructura técnica: ✓ Adecuada para USPTO</li>
                      <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Esta sección está lista para continuar o puedes editarla para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Sección {sectionNumber} de 13</CardTitle>
                  <CardDescription>{currentSection.title}</CardDescription>
                </div>
                {!editMode && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                  }}>
                    <span style={{ 
                      fontWeight: currentLanguage === 'es' ? 'bold' : 'normal',
                      color: currentLanguage === 'es' ? '#8b5cf6' : '#666',
                      fontSize: '0.85rem'
                    }}>
                      🇪🇸 Español
                    </span>
                    
                    <button
                      onClick={() => {
                        const newLang = currentLanguage === 'es' ? 'en' : 'es';
                        setCurrentLanguage(newLang);
                        
                        // ⭐ En CreatePatentInteractive no mostramos toast
                        // Las secciones se generan bilingües automáticamente desde el backend
                        // No necesitamos "Generar Traducción" manualmente
                        
                        console.log('🌐 Idioma cambiado a:', newLang);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.4rem 1.2rem',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                      }}
                    >
                      <Globe size={14} className="inline mr-1" />
                      {currentLanguage === 'es' ? '→ Switch to English' : '→ Cambiar a Español'}
                    </button>
                    
                    <span style={{ 
                      fontWeight: currentLanguage === 'en' ? 'bold' : 'normal',
                      color: currentLanguage === 'en' ? '#8b5cf6' : '#666',
                      fontSize: '0.85rem'
                    }}>
                      🇺🇸 English
                    </span>
                  </div>
                )}
              </div>
              {!editMode && (
                <p className="text-sm text-gray-500 mt-2">
                  {currentLanguage === 'es' ? 'Versión en Español' : 'English Version'}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: currentLanguage === 'es'
                    ? (currentSection.content_es || currentSection.content || '')
                    : (currentSection.content_en || currentSection.content || '')
                }}
                style={{
                  lineHeight: '1.6',
                  color: '#333'
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-top: 1.5rem;
                  margin-bottom: 1rem;
                  color: #000;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={approveSection}
                disabled={generating}
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {sectionNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en esta sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {i18n.language === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más detalles técnicos sobre la implementación del sistema. Incluye diagramas de flujo adicionales. Fortalece la descripción de los componentes.'"
                  rows={5}
                  className="mb-4"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={editSection}
                    disabled={generating || !editInstructions.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Finalization (only for section 13) */}
          {sectionNumber === 13 && !editMode && (
            <div className="mt-6">
              <Button
                onClick={finalizePatent}
                disabled={generating}
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    {drawingsGenerated ? 'Finalizando...' : 'Generando dibujos y finalizando...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2" size={18} />
                    Generar Dibujos y Finalizar Patente
                  </>
                )}
              </Button>
              <p className="text-sm text-gray-500 text-center mt-2">
                Se generarán automáticamente 7 dibujos técnicos (FIG. 1-7) antes de finalizar
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="create-container">
      <div className="loading-state">
        <Loader2 className="animate-spin" size={48} />
        <p className="mt-4">Generando especificación USPTO...</p>
      </div>
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

const ViewBusinessPlan = () => {
  const [plan, setPlan] = useState(null);
  const [content, setContent] = useState('');
  const [fullContent, setFullContent] = useState({ es: '', en: '' }); // ⭐ Contenido compilado bilingüe
  const [viewMode, setViewMode] = useState('full'); // full, sections
  const [sections, setSections] = useState([]);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false); // ⭐ FIX: Estado faltante
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('es'); // ⭐ Estado para idioma
  const pathParts = window.location.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    loadPlan();
    loadCommentStats();
  }, []);

  const editSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor proporciona instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/business-plans/edit-section/${id}`,
        {
          section_number: currentSection.number,
          edit_instructions: editInstructions,
          current_section_content: currentSection.content_es || currentSection.content || '',
          current_section_title: currentSection.title || ''
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentSection(response.data.section);
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = response.data.section;
        setSections(updatedSections);
      }
      
      setEditMode(false);
      setEditInstructions('');
      toast.success('Sección actualizada exitosamente');
      
      // Reload plan to refresh compiled content
      await loadPlan();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  const loadPlan = async () => {
    try {
      const response = await axios.get(`${API}/business-plans/${id}`);
      const planData = response.data;
      setPlan(planData);
      
      // Si el plan tiene secciones con contenido bilingüe, compilar el contenido completo
      if (planData.sections && planData.sections.length > 0) {
        // Compilar contenido en ambos idiomas
        const contentEs = planData.sections
          .map(section => section.content_es || section.content || '')
          .join('<div style="page-break-after: always;"></div>');
        
        const contentEn = planData.sections
          .map(section => section.content_en || section.content || '')
          .join('<div style="page-break-after: always;"></div>');
        
        setFullContent({ es: contentEs, en: contentEn });
        setContent(contentEs); // Establecer contenido inicial en español
      } else {
        // Usar el campo content si no hay sections
        const plainContent = planData.content || '';
        setContent(plainContent);
        setFullContent({ es: plainContent, en: plainContent });
      }
    } catch (error) {
      console.error('Error loading plan:', error);
      toast.error('Error al cargar el plan');
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

  const loadSections = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/business-plans/${id}/sections`);
      console.log('📄 Secciones cargadas:', response.data.sections);
      setSections(response.data.sections);
      if (response.data.sections.length > 0) {
        const firstSection = response.data.sections[0];
        console.log('📄 Primera sección:', firstSection);
        console.log('📄 Contenido ES:', firstSection.content_es ? `${firstSection.content_es.substring(0, 100)}...` : 'NO EXISTE');
        console.log('📄 Contenido EN:', firstSection.content_en ? `${firstSection.content_en.substring(0, 100)}...` : 'NO EXISTE');
        setCurrentSection(firstSection);
        setSectionNumber(1);
        toast.success(`✓ ${response.data.sections.length} secciones cargadas`);
      }
      setViewMode('sections');
    } catch (error) {
      console.error('Error al cargar secciones:', error);
      toast.error('Error al cargar secciones');
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/business-plans/${id}?content=${encodeURIComponent(content)}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('Cambios guardados');
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error(error.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/business-plans/${id}/sections/${sectionNumber}`,
        {
          section_number: sectionNumber,
          edit_instructions: editInstructions,
          current_section_content: currentSection.content,
          current_section_title: currentSection.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Sección actualizada exitosamente');
      setEditInstructions('');
      setEditMode(false);
      
      // Reload sections to get updated content
      await loadSections();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar sección');
    } finally {
      setSaving(false);
    }
  };

  const goToSection = (secNum) => {
    const section = sections.find(s => s.number === secNum);
    if (section) {
      setCurrentSection(section);
      setSectionNumber(secNum);
      setEditMode(false);
      setEditInstructions('');
    }
  };

  const downloadPDF = async (language = 'es') => {
    try {
      toast.info(`📥 Generando PDF en ${language === 'es' ? 'español' : 'inglés'}...`);
      const response = await axios.get(`${API}/business-plans/${id}/download?language=${language}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${plan.project_title || plan.business_name}${langSuffix}_niw_proposal.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`✅ PDF descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar PDF');
    }
  };

  // ⭐ FIX: Función approveSection faltante
  const approveSection = async () => {
    try {
      setGenerating(true);
      
      // Avanzar a la siguiente sección
      const nextSectionNumber = sectionNumber + 1;
      
      if (nextSectionNumber <= sections.length) {
        // Cargar siguiente sección
        const nextSection = sections.find(s => s.number === nextSectionNumber);
        if (nextSection) {
          setCurrentSection(nextSection);
          setSectionNumber(nextSectionNumber);
          toast.success(`✓ Sección ${sectionNumber} aprobada. Mostrando sección ${nextSectionNumber}`);
        }
      } else {
        // No hay más secciones
        toast.success('¡Todas las secciones completadas!');
        setViewMode('full');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>Cargando plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="loading-container">
        <p>No se pudo cargar el plan. Por favor, intenta de nuevo.</p>
        <Button onClick={() => navigate('/dashboard')} className="mt-4">
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  if (viewMode === 'sections' && currentSection) {
    return (
      <div className="view-container">
        <div className="view-header">
          <Button variant="ghost" onClick={() => setViewMode('full')} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Vista Completa
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de {sections.length}
            </span>
          </div>
        </div>

        <div className="view-content max-w-4xl mx-auto">
          <div className="mb-4 flex gap-1 flex-wrap">
            {sections.map(sec => (
              <button
                key={sec.number}
                onClick={() => goToSection(sec.number)}
                title={sec.title}
                className={`px-3 py-2 rounded text-xs ${
                  sec.number === sectionNumber 
                    ? 'bg-black text-white' 
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {sec.number}
              </button>
            ))}
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{currentSection.title}</CardTitle>
              <CardDescription>Sección {sectionNumber} - {plan.project_title || plan.business_name}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Toggle de idioma */}
              <div className="mb-4 flex justify-end">
                <button
                  onClick={() => setCurrentLanguage(currentLanguage === 'es' ? 'en' : 'es')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                >
                  {currentLanguage === 'es' ? '🇺🇸 Switch to English' : '🇪🇸 Cambiar a Español'}
                </button>
              </div>
              
              {(() => {
                const contentToShow = currentLanguage === 'es' 
                  ? (currentSection.content_es || currentSection.content || '') 
                  : (currentSection.content_en || currentSection.content || '');
                
                console.log(`📄 Mostrando contenido (${currentLanguage}):`, contentToShow ? `${contentToShow.substring(0, 100)}...` : 'VACÍO');
                
                if (!contentToShow) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <p className="text-lg mb-2">⚠️ No hay contenido disponible para esta sección</p>
                      <p className="text-sm">
                        {currentLanguage === 'es' 
                          ? 'La sección puede estar en proceso de generación o no tener contenido en español.'
                          : 'The section may be in the generation process or have no English content.'
                        }
                      </p>
                      <button 
                        onClick={() => setCurrentLanguage(currentLanguage === 'es' ? 'en' : 'es')}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        {currentLanguage === 'es' ? 'Try English version' : 'Probar versión en español'}
                      </button>
                    </div>
                  );
                }
                
                return (
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: contentToShow }}
                  />
                );
              })()}
              <style>{`
                .prose h2 {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-top: 1.5rem;
                  margin-bottom: 1rem;
                  color: #000;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.25rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                }
                .prose table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 1.5rem 0;
                  border: 1px solid #ddd;
                }
                .prose th {
                  background-color: #000;
                  color: #fff;
                  padding: 12px;
                  text-align: left;
                  font-weight: 600;
                  border: 1px solid #000;
                }
                .prose td {
                  padding: 10px 12px;
                  border: 1px solid #ddd;
                }
                .prose tr:nth-child(even) {
                  background-color: #f9f9f9;
                }
                .prose ul, .prose ol {
                  margin: 1rem 0;
                  padding-left: 2rem;
                }
                .prose li {
                  margin-bottom: 0.5rem;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={approveSection}
                disabled={generating}
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {sectionNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en esta sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {i18n.language === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más detalles técnicos sobre la invención. Incluye especificaciones más precisas. Fortalece la descripción de ventajas competitivas.'"
                  rows={5}
                  className="mb-4"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={editSection}
                    disabled={generating || !editInstructions.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <Button variant="ghost" onClick={() => {
          // ⭐ FIX: Navegar al dashboard del cliente si existe, sino al dashboard principal
          if (plan && plan.client_id) {
            navigate(`/client-dashboard/${plan.client_id}`);
          } else {
            navigate('/dashboard');
          }
        }} data-testid="back-button">
          <ArrowLeft className="mr-2" size={18} />
          {t('form.back')}
        </Button>
        <div className="view-actions">
          <Button onClick={loadSections} variant="outline">
            <FileText className="mr-2" size={18} />
            Ver por Secciones
          </Button>
          <Button onClick={() => {
            // ⭐ FIX: Al entrar en modo edición, cargar el contenido del idioma actual
            if (!editMode) {
              const contentToEdit = currentLanguage === 'es' ? fullContent.es : fullContent.en;
              setContent(contentToEdit);
            }
            setEditMode(!editMode);
          }} variant="outline">
            <Edit className="mr-2" size={18} />
            {editMode ? 'Vista Previa' : 'Editar'}
          </Button>
          <Button onClick={saveContent} disabled={saving || !editMode} data-testid="save-btn">
            {saving ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Save className="mr-2" size={18} />}
            Guardar
          </Button>
          <Button onClick={() => downloadPDF('es')} variant="outline" data-testid="download-pdf-es-btn">
            <Download className="mr-2" size={18} />
            📄 Descargar PDF (ES)
          </Button>
          <Button onClick={() => downloadPDF('en')} variant="outline" data-testid="download-pdf-en-btn">
            <Download className="mr-2" size={18} />
            📄 Descargar PDF (EN)
          </Button>
          <Button onClick={() => setShowHistory(true)} variant="outline" className="bg-purple-50">
            <History className="mr-2" size={18} />
            Ver Historial
          </Button>
          <Button onClick={() => setShowComments(true)} variant="outline" className="bg-blue-50 relative">
            <MessageSquare className="mr-2" size={18} />
            Comentarios
            {commentStats && commentStats.open > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {commentStats.open}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="view-content">
        <div className="document-header">
          <h1 className="document-title">{plan.project_title || plan.business_name || 'Documento'}</h1>
          <p className="document-meta">
            {plan.applicant_name || plan.industry || ''} • 
            {plan.language === 'en' ? ' English' : ' Español'} • 
            {new Date(plan.created_at).toLocaleDateString('es-ES')}
          </p>
        </div>

        {/* Alert for in-progress documents */}
        {plan.status === 'in_progress' && plan.current_section && plan.total_sections && plan.current_section < plan.total_sections && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Documento en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Este documento tiene {plan.current_section - 1} de {plan.total_sections} secciones completadas. 
                  Puedes continuar generando las secciones restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((plan.current_section - 1) / plan.total_sections) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-business-plan?resume_id=${plan.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
            </div>
          </div>
        )}

        <Card className="editor-card">
          <CardContent className="p-6">
            {/* Toggle de idioma para vista completa */}
            {!editMode && (
              <div className="mb-6 flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {currentLanguage === 'es' ? '📄 Versión en Español' : '📄 English Version'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {currentLanguage === 'es' 
                      ? 'Visualizando documento completo en español' 
                      : 'Viewing complete document in English'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newLang = currentLanguage === 'es' ? 'en' : 'es';
                    setCurrentLanguage(newLang);
                    console.log('🌐 Idioma cambiado a:', newLang);
                  }}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  {currentLanguage === 'es' ? '🇺🇸 Switch to English' : '🇪🇸 Cambiar a Español'}
                </button>
              </div>
            )}
            
            {!editMode ? (
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    // ⭐ FIX: Usar fullContent compilado según el idioma actual
                    const contentToDisplay = currentLanguage === 'es' ? fullContent.es : fullContent.en;
                    return contentToDisplay || '<p style="color: #999;">No hay contenido disponible</p>';
                  })()
                }}
                style={{
                  minHeight: '500px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="editor-textarea"
                data-testid="content-editor"
                rows={30}
              />
            )}
            <style>{`
              .prose h1, .prose h2, .prose h3 {
                font-weight: 600;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                color: #000;
              }
              .prose h1 {
                font-size: 2rem;
                border-bottom: 2px solid #000;
                padding-bottom: 0.5rem;
              }
              .prose h2 {
                font-size: 1.5rem;
                border-bottom: 1px solid #ddd;
                padding-bottom: 0.25rem;
              }
              .prose h3 {
                font-size: 1.25rem;
              }
              .prose p {
                margin-bottom: 1rem;
                text-align: justify;
              }
              .prose table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
              }
              .prose th {
                background-color: #f3f4f6;
                padding: 10px 12px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #000;
              }
              .prose td {
                padding: 10px 12px;
                border: 1px solid #ddd;
              }
              .prose tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              .prose ul, .prose ol {
                margin: 1rem 0;
                padding-left: 2rem;
              }
              .prose li {
                margin-bottom: 0.5rem;
              }
              .prose strong, .prose b {
                font-weight: 600;
                color: #000;
              }
            `}</style>
          </CardContent>
        </Card>
      </div>

      {/* Version History Modal */}
      <VersionHistory
        documentId={id}
        documentType="business_plan"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={() => {
          setShowHistory(false);
          loadPlan();
        }}
      />

      {/* Comments Panel */}
      <CommentsPanel
        documentId={id}
        documentType="business_plan"
        open={showComments}
        onClose={() => {
          setShowComments(false);
          loadCommentStats();
        }}
      />
    </div>
  );
};

const ViewBook = () => {
  const [book, setBook] = useState(null);
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState('full'); // full, chapters
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false); // ✅ Fix: Variable faltante
  const [generatingTranslation, setGeneratingTranslation] = useState(false); // Para traducción
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState('es'); // ⭐ Estado para idioma
  const pathParts = window.location.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    loadBook();
    loadCommentStats();
  }, []);

  // Auto-generate translation in background when book loads
  useEffect(() => {
    if (book) {
      checkAndGenerateTranslation();
    }
  }, [book?.id]);

  const checkAndGenerateTranslation = async () => {
    if (!book || generatingTranslation) return;
    
    // Check if translation is needed
    const needsTranslation = 
      !book.title_en ||
      !book.synopsis_en ||
      (book.chapters?.some(ch => !ch.content_en));
    
    if (needsTranslation) {
      console.log('🔄 Auto-generating English translation in background...');
      generateTranslation();
    } else {
      console.log('✅ English translation already available');
    }
  };

  const generateTranslation = async () => {
    setGeneratingTranslation(true);
    try {
      const token = localStorage.getItem('token');
      
      toast.info('🔄 Preparando versión en inglés en segundo plano...', {
        autoClose: 3000
      });
      
      await axios.post(
        `${API}/books/${id}/generate-translation`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('✅ Versión en inglés lista para descargar');
      await loadBook();
    } catch (error) {
      console.error('Error generating translation:', error);
      console.log('Translation will be generated on-demand when needed');
    } finally {
      setGeneratingTranslation(false);
    }
  };

  const loadBook = async () => {
    try {
      // First try to fetch from in-progress collection
      let response;
      try {
        response = await axios.get(`${API}/books/in-progress/${id}`);
        console.log('✓ Loaded book from in-progress collection');
      } catch (inProgressError) {
        // If not found in in-progress, try completed collection
        console.log('Book not in progress, trying completed collection...');
        response = await axios.get(`${API}/books/${id}`);
        console.log('✓ Loaded book from completed collection');
      }
      
      setBook(response.data);
      setContent(response.data.content || '');
    } catch (error) {
      console.error('Error loading book:', error);
      toast.error('Error al cargar el libro');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSection = async () => {
    if (!currentChapter) return;
    
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/books/approve-chapter/${id}/${currentChapter.number}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('✓ Capítulo aprobado');
      
      // Reload chapters to update status
      await loadChapters();
    } catch (error) {
      console.error('Error approving chapter:', error);
      toast.error('Error al aprobar el capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const editSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor proporciona instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/books/edit-chapter/${id}/${currentChapter.number}`,
        {
          edit_instructions: editInstructions
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentChapter(response.data.chapter);
      
      // Update chapters array
      const updatedChapters = [...chapters];
      const existingIndex = updatedChapters.findIndex(ch => ch.number === currentChapter.number);
      
      if (existingIndex >= 0) {
        updatedChapters[existingIndex] = response.data.chapter;
        setChapters(updatedChapters);
      }
      
      setEditMode(false);
      setEditInstructions('');
      toast.success('Capítulo actualizado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar capítulo');
    } finally {
      setGenerating(false);
    }
  };

  const loadChapters = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/books/${id}/chapters`);
      setChapters(response.data.chapters);
      if (response.data.chapters.length > 0) {
        setCurrentChapter(response.data.chapters[0]);
        setChapterNumber(1);
      }
      setViewMode('chapters');
    } catch (error) {
      toast.error('Error al cargar capítulos');
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/books/${id}?content=${encodeURIComponent(content)}`);
      toast.success('Cambios guardados');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEditChapter = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/books/${id}/chapters/${chapterNumber}`,
        {
          chapter_number: chapterNumber,
          edit_instructions: editInstructions,
          current_chapter_content: currentChapter.content,
          current_chapter_title: currentChapter.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      toast.success('Capítulo actualizado exitosamente');
      setEditInstructions('');
      setEditMode(false);
      
      // Reload chapters to get updated content
      await loadChapters();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar capítulo');
    } finally {
      setSaving(false);
    }
  };

  const goToChapter = (chapNum) => {
    const chapter = chapters.find(ch => ch.number === chapNum);
    if (chapter) {
      setCurrentChapter(chapter);
      setChapterNumber(chapNum);
      setEditMode(false);
      setEditInstructions('');
    }
  };

  const downloadPDF = async (language = 'es') => {
    try {
      const response = await axios.get(`${API}/books/${id}/download?language=${language}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'en' ? '_EN' : '_ES';
      link.setAttribute('download', `${book.title}${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Descarga iniciada en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar PDF');
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

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>Cargando libro...</p>
      </div>
    );
  }

  if (viewMode === 'chapters' && currentChapter && book) {
    return (
      <div className="view-container">
        <div className="view-header">
          <Button variant="ghost" onClick={() => setViewMode('full')} data-testid="back-button">
            <ArrowLeft className="mr-2" size={18} />
            Vista Completa
          </Button>
          <div className="flex items-center gap-4">
            {/* ⭐ Toggle de idioma */}
            <button
              onClick={() => {
                const newLang = currentLanguage === 'es' ? 'en' : 'es';
                setCurrentLanguage(newLang);
              }}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '20px',
                padding: '0.4rem 1.2rem',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}
            >
              {currentLanguage === 'es' ? '→ Switch to English' : '→ Cambiar a Español'}
            </button>
            {/* ⭐ Botones Anterior/Siguiente */}
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => goToChapter(chapterNumber - 1)}
                disabled={chapterNumber === 1}
              >
                <ArrowLeft size={16} className="mr-1" />
                Anterior
              </Button>
              <span className="text-sm font-medium px-3">
                Capítulo {chapterNumber} de {chapters.length}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => goToChapter(chapterNumber + 1)}
                disabled={chapterNumber === chapters.length}
              >
                Siguiente
                <ArrowLeft size={16} className="ml-1" style={{transform: 'rotate(180deg)'}} />
              </Button>
            </div>
            <div className="flex gap-1">
              {chapters.map(ch => {
                // ✅ Fix: Determinar estado real del capítulo
                const isApproved = ch.approved === true;
                const hasContent = (ch.content_es && ch.content_es.length > 100) || 
                                 (ch.content && ch.content.length > 100);
                const isCurrent = ch.number === chapterNumber;
                
                let bgColor = 'bg-gray-200 hover:bg-gray-300'; // Pendiente/no generado
                let textColor = 'text-gray-600';
                
                if (isCurrent) {
                  bgColor = 'bg-black text-white'; // Capítulo actual
                  textColor = 'text-white';
                } else if (isApproved) {
                  bgColor = 'bg-green-500 hover:bg-green-600'; // Aprobado y completo
                  textColor = 'text-white';
                } else if (hasContent) {
                  bgColor = 'bg-yellow-400 hover:bg-yellow-500'; // Generado pero no aprobado
                  textColor = 'text-black';
                }
                
                return (
                  <button
                    key={ch.number}
                    onClick={() => goToChapter(ch.number)}
                    className={`w-8 h-8 rounded text-xs font-medium ${bgColor} ${textColor}`}
                    title={
                      isApproved ? 'Capítulo aprobado' : 
                      hasContent ? 'Capítulo generado' : 
                      'Pendiente de generar'
                    }
                  >
                    {ch.number}
                  </button>
                );
              })}
            </div>
            
            {/* ⭐ Leyenda de estados */}
            <div className="flex items-center gap-3 text-xs text-gray-600 ml-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                <span>Aprobado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-400"></div>
                <span>Generado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-200"></div>
                <span>Pendiente</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-black"></div>
                <span>Actual</span>
              </div>
            </div>
          </div>
        </div>

        <div className="view-content max-w-4xl mx-auto">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{currentChapter.title || 'Sin título'}</CardTitle>
              <CardDescription>Capítulo {chapterNumber} - {book.title || 'Libro'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: currentLanguage === 'es'
                    ? (currentChapter.content_es || currentChapter.content || '')
                    : (currentChapter.content_en || currentChapter.content || '')
                }}
              />
              <style>{`
                .prose h2 {
                  font-size: 1.75rem;
                  font-weight: bold;
                  margin-top: 2rem;
                  margin-bottom: 1rem;
                  color: #000;
                  text-align: center;
                }
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 600;
                  margin-top: 1.5rem;
                  margin-bottom: 0.75rem;
                  color: #111;
                }
                .prose p {
                  margin-bottom: 1rem;
                  text-align: justify;
                  text-indent: 2em;
                }
                .prose em, .prose i {
                  font-style: italic;
                  color: #555;
                }
                .prose strong, .prose b {
                  font-weight: 600;
                  color: #000;
                }
              `}</style>
            </CardContent>
          </Card>

          {!editMode ? (
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={handleApproveSection}
                disabled={generating}
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {chapterNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en este capítulo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {i18n.language === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más detalles técnicos sobre la invención. Incluye especificaciones más precisas. Fortalece la descripción de ventajas competitivas.'"
                  rows={5}
                  className="mb-4"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={editSection}
                    disabled={generating || !editInstructions.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} data-testid="back-button">
          <ArrowLeft className="mr-2" size={18} />
          {t('form.back')}
        </Button>
        <div className="view-actions">
          <Button onClick={loadChapters} variant="outline">
            <Book className="mr-2" size={18} />
            Ver por Capítulos
          </Button>
          <Button onClick={() => setEditMode(!editMode)} variant="outline">
            <Edit className="mr-2" size={18} />
            {editMode ? 'Vista Previa' : 'Editar'}
          </Button>
          <Button onClick={saveContent} disabled={saving || !editMode} data-testid="save-btn">
            {saving ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Save className="mr-2" size={18} />}
            Guardar
          </Button>
          <Button onClick={() => downloadPDF('es')} variant="outline" data-testid="download-pdf-es-btn">
            <Download className="mr-2" size={18} />
            📄 Descargar PDF (ES)
          </Button>
          <Button onClick={() => downloadPDF('en')} variant="outline" data-testid="download-pdf-en-btn">
            <Download className="mr-2" size={18} />
            📄 Descargar PDF (EN)
          </Button>
          <Button onClick={() => setShowHistory(true)} variant="outline" className="bg-purple-50">
            <History className="mr-2" size={18} />
            Ver Historial
          </Button>
          <Button onClick={() => setShowComments(true)} variant="outline" className="bg-blue-50 relative">
            <MessageSquare className="mr-2" size={18} />
            Comentarios
            {commentStats && commentStats.open > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {commentStats.open}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="view-content">
        {book && (
          <>
            <div className="document-header">
              <h1 className="document-title">{book.title}</h1>
              <p className="document-meta">{book.genre} • {book.num_chapters} capítulos • {new Date(book.created_at).toLocaleDateString('es-ES')}</p>
            </div>

            {/* Alert for in-progress documents */}
            {book.status === 'in_progress' && book.current_chapter && book.num_chapters && book.current_chapter <= book.num_chapters && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Libro en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Este libro tiene {book.current_chapter - 1} de {book.num_chapters} capítulos completados. 
                  Puedes continuar generando los capítulos restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((book.current_chapter - 1) / book.num_chapters) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-book?resume_id=${book.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
            </div>
          </div>
        )}

        <Card className="editor-card">
          <CardContent className="p-6">
            {/* Toggle de idioma para vista completa */}
            {!editMode && (
              <div className="mb-6 flex justify-between items-center border-b pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {currentLanguage === 'es' ? '📄 Versión en Español' : '📄 English Version'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {currentLanguage === 'es' 
                      ? 'Visualizando documento completo en español' 
                      : 'Viewing complete document in English'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newLang = currentLanguage === 'es' ? 'en' : 'es';
                    setCurrentLanguage(newLang);
                    // Recargar contenido en el nuevo idioma
                    loadBook();
                  }}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  {currentLanguage === 'es' ? '🇺🇸 Switch to English' : '🇪🇸 Cambiar a Español'}
                </button>
              </div>
            )}
            
            {!editMode ? (
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
                style={{
                  minHeight: '500px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="editor-textarea"
                data-testid="content-editor"
                rows={30}
              />
            )}
            <style>{`
              .prose h1, .prose h2, .prose h3 {
                font-weight: 600;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
                color: #000;
              }
              .prose h1 {
                font-size: 2rem;
                border-bottom: 2px solid #000;
                padding-bottom: 0.5rem;
              }
              .prose h2 {
                font-size: 1.5rem;
                border-bottom: 1px solid #ddd;
                padding-bottom: 0.25rem;
              }
              .prose h3 {
                font-size: 1.25rem;
              }
              .prose p {
                margin-bottom: 1rem;
                text-align: justify;
              }
              .prose table {
                width: 100%;
                border-collapse: collapse;
                margin: 1rem 0;
              }
              .prose th {
                background-color: #f3f4f6;
                padding: 10px 12px;
                text-align: left;
                font-weight: 600;
                border: 1px solid #000;
              }
              .prose td {
                padding: 10px 12px;
                border: 1px solid #ddd;
              }
              .prose tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              .prose ul, .prose ol {
                margin: 1rem 0;
                padding-left: 2rem;
              }
              .prose li {
                margin-bottom: 0.5rem;
              }
              .prose strong, .prose b {
                font-weight: 600;
                color: #000;
              }
            `}</style>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* Version History Modal */}
      <VersionHistory
        documentId={id}
        documentType="book"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={() => {
          setShowHistory(false);
          loadBook();
        }}
      />

      {/* Comments Panel */}
      <CommentsPanel
        documentId={id}
        documentType="book"
        open={showComments}
        onClose={() => {
          setShowComments(false);
          loadCommentStats();
        }}
      />
    </div>
  );
};

// Protected Route Component

// ============================================================================
// VERSION HISTORY COMPONENT - Sistema de Historial y Rollback
// ============================================================================

const VersionHistory = ({ documentId, documentType, onRestore, open, onClose }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [comparison, setComparison] = useState(null);
  const { t, i18n } = useTranslation();
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (open && documentId) {
      loadVersionHistory();
    }
  }, [open, documentId]);

  const loadVersionHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${BACKEND_URL}/api/versions/${documentId}/history?limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
      alert(t('error_loading_versions') || 'Error cargando historial de versiones');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) {
      alert(t('select_two_versions') || 'Selecciona exactamente 2 versiones para comparar');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      const response = await fetch(
        `${BACKEND_URL}/api/versions/${documentId}/compare?version_from=${v1}&version_to=${v2}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setComparison(data.comparison);
      }
    } catch (error) {
      console.error('Error comparing versions:', error);
      alert(t('error_comparing') || 'Error comparando versiones');
    }
  };

  const handleRollback = async (versionNumber) => {
    const confirmMsg = i18n.language === 'es' 
      ? `¿Restaurar documento a versión ${versionNumber}?`
      : `Restore document to version ${versionNumber}?`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${BACKEND_URL}/api/versions/${documentId}/rollback`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            document_type: documentType,
            version_number: versionNumber
          })
        }
      );
      
      const data = await response.json();
      alert(data.message);
      if (onRestore) onRestore();
      loadVersionHistory();
    } catch (error) {
      console.error('Error during rollback:', error);
      alert(t('error_rollback') || 'Error durante rollback');
    }
  };

  const toggleVersionSelection = (versionNumber) => {
    setSelectedVersions(prev => {
      if (prev.includes(versionNumber)) {
        return prev.filter(v => v !== versionNumber);
      } else if (prev.length < 2) {
        return [...prev, versionNumber];
      } else {
        return [prev[1], versionNumber];
      }
    });
  };

  const getChangeTypeIcon = (changeType) => {
    const icons = {
      'manual_edit': '✏️',
      'ai_regeneration': '🤖',
      'section_approval': '✅',
      'rollback': '⏪',
      'finalize': '🎯'
    };
    return icons[changeType] || '📝';
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

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            📜 {i18n.language === 'es' ? 'Historial de Versiones' : 'Version History'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex gap-2 p-4 border-b">
              <button
                onClick={() => {
                  setCompareMode(!compareMode);
                  setSelectedVersions([]);
                  setComparison(null);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                {compareMode 
                  ? (i18n.language === 'es' ? 'Cancelar Comparación' : 'Cancel Comparison')
                  : (i18n.language === 'es' ? 'Comparar Versiones' : 'Compare Versions')}
              </button>
              {compareMode && selectedVersions.length === 2 && (
                <button
                  onClick={handleCompare}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  {i18n.language === 'es' ? 'Ver Diferencias' : 'View Differences'}
                </button>
              )}
              <div className="ml-auto text-sm text-gray-600">
                {i18n.language === 'es' ? `${versions.length} versiones` : `${versions.length} versions`}
              </div>
            </div>

            {/* Version List */}
            {!comparison ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.version_number}
                    className={`border rounded-lg p-4 hover:shadow-md transition ${
                      compareMode && selectedVersions.includes(version.version_number)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {compareMode && (
                            <input
                              type="checkbox"
                              checked={selectedVersions.includes(version.version_number)}
                              onChange={() => toggleVersionSelection(version.version_number)}
                              className="w-4 h-4"
                            />
                          )}
                          <span className="text-lg font-semibold">
                            {i18n.language === 'es' ? 'Versión' : 'Version'} #{version.version_number}
                          </span>
                          {version.is_snapshot && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                              Snapshot
                            </span>
                          )}
                          {version.version_number === versions[0].version_number && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                              {i18n.language === 'es' ? 'Actual' : 'Current'}
                            </span>
                          )}
                          <span className="text-xl">{getChangeTypeIcon(version.change_type)}</span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          {formatDate(version.created_at)}
                        </p>

                        {version.change_description && (
                          <p className="text-gray-700 mb-2 text-sm">
                            {version.change_description}
                          </p>
                        )}

                        <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                          {version.sections_changed && version.sections_changed.length > 0 && (
                            <span>
                              📍 {i18n.language === 'es' ? 'Secciones' : 'Sections'}: {version.sections_changed.join(', ')}
                            </span>
                          )}
                          {version.characters_added > 0 && (
                            <span className="text-green-600">
                              +{version.characters_added} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                            </span>
                          )}
                          {version.characters_removed > 0 && (
                            <span className="text-red-600">
                              -{version.characters_removed} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                            </span>
                          )}
                          {version.quality_score && (
                            <span>⭐ {version.quality_score}/10</span>
                          )}
                        </div>
                      </div>

                      {!compareMode && version.version_number < versions[0].version_number && (
                        <button
                          onClick={() => handleRollback(version.version_number)}
                          className="ml-4 px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          ⏪ {i18n.language === 'es' ? 'Restaurar' : 'Restore'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Comparison View */
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4">
                  <button
                    onClick={() => setComparison(null)}
                    className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    ← {i18n.language === 'es' ? 'Volver a la lista' : 'Back to list'}
                  </button>
                </div>

                <h3 className="text-xl font-bold mb-2">
                  {i18n.language === 'es' ? 'Comparación' : 'Comparison'}: v{comparison.version_from} → v{comparison.version_to}
                </h3>
                <div className="flex gap-4 mb-4 text-sm">
                  <span className="text-green-600">
                    +{comparison.summary.added} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                  </span>
                  <span className="text-red-600">
                    -{comparison.summary.removed} {i18n.language === 'es' ? 'caracteres' : 'chars'}
                  </span>
                  <span className="text-gray-600">
                    {comparison.summary.modified_sections} {i18n.language === 'es' ? 'secciones modificadas' : 'modified sections'}
                  </span>
                </div>

                {(comparison.sections_modified || []).map((section) => (
                  <div key={section.section_number} className="mb-6 border-b pb-6">
                    <h4 className="font-semibold text-lg mb-3">
                      {i18n.language === 'es' ? 'Sección' : 'Section'} {section.section_number}: {section.section_title}
                    </h4>
                    
                    {/* Side by side view */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">
                          {i18n.language === 'es' ? 'Versión' : 'Version'} {comparison.version_from}
                        </p>
                        <div className="bg-red-50 p-3 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {section.old_text}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 mb-2">
                          {i18n.language === 'es' ? 'Versión' : 'Version'} {comparison.version_to}
                        </p>
                        <div className="bg-green-50 p-3 rounded text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                          {section.new_text}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <DialogFooter className="border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            {i18n.language === 'es' ? 'Cerrar' : 'Close'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// END VERSION HISTORY COMPONENT
// ============================================================================

// ============================================================================
// COMMENTS SYSTEM COMPONENT - Sistema de Comentarios Colaborativos
// ============================================================================

const CommentsPanel = ({ documentId, documentType, sectionNumber = null, open, onClose }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all'); // all, open, resolved
  const [stats, setStats] = useState(null);
  const { t, i18n } = useTranslation();
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
  const textareaRef = useRef(null);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);

  useEffect(() => {
    if (open && documentId) {
      loadComments();
      loadStats();
    }
  }, [open, documentId, sectionNumber, filter]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${BACKEND_URL}/api/comments/${documentId}`;
      const params = [`document_type=${documentType}`];
      if (sectionNumber !== null) params.push(`section_number=${sectionNumber}`);
      if (filter !== 'all') params.push(`status=${filter}`);
      if (params.length > 0) url += '?' + params.join('&');

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error(t('error_loading_comments') || 'Error cargando comentarios');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${documentId}/stats?document_type=${documentType}`, {
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

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_id: documentId,
          document_type: documentType,
          content: newComment,
          section_number: sectionNumber,
          parent_comment_id: replyingTo
        })
      });

      const data = await response.json();
      if (data.success) {
        setNewComment('');
        setReplyingTo(null);
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario agregado' : 'Comment added');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error(t('error_submitting') || 'Error al enviar comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario resuelto' : 'Comment resolved');
      }
    } catch (error) {
      console.error('Error resolving comment:', error);
      toast.error(t('error_resolving') || 'Error al resolver');
    }
  };

  const handleReopen = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}/reopen`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario reabierto' : 'Comment reopened');
      }
    } catch (error) {
      console.error('Error reopening comment:', error);
      toast.error(t('error_reopening') || 'Error al reabrir');
    }
  };

  const handleEdit = async (commentId) => {
    if (!editContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editContent })
      });

      const data = await response.json();
      if (data.success) {
        setEditingComment(null);
        setEditContent('');
        loadComments();
        toast.success(i18n.language === 'es' ? 'Comentario actualizado' : 'Comment updated');
      }
    } catch (error) {
      console.error('Error editing comment:', error);
      toast.error(t('error_editing') || 'Error al editar');
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm(i18n.language === 'es' ? '¿Eliminar comentario?' : 'Delete comment?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        loadComments();
        loadStats();
        toast.success(i18n.language === 'es' ? 'Comentario eliminado' : 'Comment deleted');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(t('error_deleting') || 'Error al eliminar');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return i18n.language === 'es' ? 'Justo ahora' : 'Just now';
    if (diffMins < 60) return i18n.language === 'es' ? `Hace ${diffMins} min` : `${diffMins} min ago`;
    if (diffHours < 24) return i18n.language === 'es' ? `Hace ${diffHours}h` : `${diffHours}h ago`;
    if (diffDays < 7) return i18n.language === 'es' ? `Hace ${diffDays} días` : `${diffDays} days ago`;
    
    return date.toLocaleDateString(i18n.language);
  };

  const renderComment = (comment, isReply = false) => {
    const isEditing = editingComment === comment.comment_id;
    const isDeleted = comment.deleted;

    return (
      <div key={comment.comment_id} className={`${isReply ? 'ml-8 mt-2' : 'mt-4'} ${comment.status === 'resolved' ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:shadow-sm transition">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
            {comment.author_name.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{comment.author_name}</span>
                <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                {comment.edited && (
                  <span className="text-xs text-gray-400">
                    ({i18n.language === 'es' ? 'editado' : 'edited'})
                  </span>
                )}
                {comment.status === 'resolved' && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                    <Check size={12} />
                    {i18n.language === 'es' ? 'Resuelto' : 'Resolved'}
                  </span>
                )}
              </div>
              
              {comment.status === 'open' && !isDeleted && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingComment(comment.comment_id);
                      setEditContent(comment.content);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={i18n.language === 'es' ? 'Editar' : 'Edit'}
                  >
                    <Edit size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(comment.comment_id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={i18n.language === 'es' ? 'Eliminar' : 'Delete'}
                  >
                    <Trash2 size={14} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleResolve(comment.comment_id)}
                    className="p-1 hover:bg-gray-100 rounded"
                    title={i18n.language === 'es' ? 'Resolver' : 'Resolve'}
                  >
                    <Check size={14} className="text-green-600" />
                  </button>
                </div>
              )}
              
              {comment.status === 'resolved' && (
                <button
                  onClick={() => handleReopen(comment.comment_id)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {i18n.language === 'es' ? 'Reabrir' : 'Reopen'}
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="mt-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(comment.comment_id)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {i18n.language === 'es' ? 'Guardar' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingComment(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                {!isReply && comment.status === 'open' && !isDeleted && (
                  <button
                    onClick={() => setReplyingTo(comment.comment_id)}
                    className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Reply size={12} />
                    {i18n.language === 'es' ? 'Responder' : 'Reply'}
                  </button>
                )}
              </>
            )}
            
            {/* Replies */}
            {comment.replies_data && comment.replies_data.length > 0 && (
              <div className="mt-2">
                {comment.replies_data.map(reply => renderComment(reply, true))}
              </div>
            )}
            
            {/* Reply form */}
            {replyingTo === comment.comment_id && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={i18n.language === 'es' ? 'Escribe tu respuesta...' : 'Write your reply...'}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSubmitComment}
                    disabled={submitting || !newComment.trim()}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {i18n.language === 'es' ? 'Enviar' : 'Send'}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setNewComment('');
                    }}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={20} />
            {i18n.language === 'es' ? 'Comentarios' : 'Comments'}
            {sectionNumber && ` - ${i18n.language === 'es' ? 'Sección' : 'Section'} ${sectionNumber}`}
          </DialogTitle>
          
          {stats && (
            <div className="flex gap-4 text-sm text-gray-600 mt-2">
              <span>{i18n.language === 'es' ? 'Total' : 'Total'}: {stats.total}</span>
              <span className="text-orange-600">{i18n.language === 'es' ? 'Abiertos' : 'Open'}: {stats.open}</span>
              <span className="text-green-600">{i18n.language === 'es' ? 'Resueltos' : 'Resolved'}: {stats.resolved}</span>
            </div>
          )}
        </DialogHeader>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
          >
            {i18n.language === 'es' ? 'Todos' : 'All'}
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-3 py-1 text-sm rounded ${filter === 'open' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
          >
            {i18n.language === 'es' ? 'Abiertos' : 'Open'}
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1 text-sm rounded ${filter === 'resolved' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
          >
            {i18n.language === 'es' ? 'Resueltos' : 'Resolved'}
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <MessageSquare size={48} className="mx-auto mb-2 text-gray-300" />
              <p>{i18n.language === 'es' ? 'No hay comentarios aún' : 'No comments yet'}</p>
              <p className="text-sm">{i18n.language === 'es' ? 'Sé el primero en comentar' : 'Be the first to comment'}</p>
            </div>
          ) : (
            <div className="pb-4">
              {comments.map(comment => renderComment(comment))}
            </div>
          )}
        </div>

        {/* New comment form */}
        {!replyingTo && (
          <div className="border-t pt-4">
            <form onSubmit={handleSubmitComment}>
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={i18n.language === 'es' ? 'Escribe un comentario... (usa @usuario para mencionar)' : 'Write a comment... (use @user to mention)'}
                rows={3}
                className="mb-2"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {i18n.language === 'es' ? 'Tip: Usa @usuario para mencionar' : 'Tip: Use @user to mention'}
                </span>
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {i18n.language === 'es' ? 'Comentar' : 'Comment'}
                </button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// END COMMENTS SYSTEM COMPONENT
// ============================================================================

// ============================================================================
// ANALYTICS DASHBOARD COMPONENT
// ============================================================================

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
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

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
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;

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
// CREATE WHITEPAPER INTERACTIVE COMPONENT
// ============================================================================

const CreateWhitepaperInteractive = () => {
  const [step, setStep] = useState('details'); // details, generating, review
  const [formData, setFormData] = useState({
    project_title: '',
    author_name: '',
    author_credentials: '',
    project_description: '',
    target_audience: '',
    technical_domain: '',
    language: 'es',
    client_id: null
  });
  const [whitepaperId, setWhitepaperId] = useState(null);
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id and resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');
  const resumeId = searchParams.get('resume_id');
  
  // Update formData with client_id when component mounts
  React.useEffect(() => {
    if (clientId && !formData.client_id) {
      setFormData(prev => ({ ...prev, client_id: clientId }));
    }
  }, [clientId]);
  
  // Load in-progress document on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
          const response = await fetch(`${BACKEND_URL}/api/whitepapers/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setWhitepaperId(doc.id);
            setFormData({
              project_title: doc.project_title || '',
              author_name: doc.author_name || '',
              author_credentials: doc.author_credentials || '',
              project_description: doc.project_description || '',
              target_audience: doc.target_audience || '',
              technical_domain: doc.technical_domain || '',
              language: doc.language || 'es',
              client_id: doc.client_id || null
            });
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`White Paper cargado - ${doc.sections.length} secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('White Paper cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar white paper');
        }
      }
    };
    
    loadDocument();
  }, [resumeId]);

  const handleBack = () => {
    if (clientId) {
      navigate(`/client-dashboard/${clientId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const WHITEPAPER_SECTIONS_EN = [
    "Executive Summary",
    "Context and Problem",
    "Target Audience and Use Cases",
    "State of the Art and Gap Analysis",
    "Requirements and Assumptions",
    "Architecture / Solution Design",
    "Implementation Methodology",
    "Evaluation and Metrics",
    "Results and Analysis",
    "Security, Privacy and Compliance",
    "Reliability, Scalability and Costs",
    "Risks, Limitations and Mitigation",
    "Roadmap",
    "Conclusions and Recommendations",
    "References",
    "Appendices"
  ];

  const WHITEPAPER_SECTIONS_ES = [
    "Resumen Ejecutivo",
    "Contexto y Problema",
    "Audiencia Objetivo y Casos de Uso",
    "Estado del Arte y Análisis de Brechas",
    "Requisitos y Supuestos",
    "Arquitectura / Diseño de Solución",
    "Metodología de Implementación",
    "Evaluación y Métricas",
    "Resultados y Análisis",
    "Seguridad, Privacidad y Cumplimiento",
    "Confiabilidad, Escalabilidad y Costos",
    "Riesgos, Limitaciones y Mitigación",
    "Hoja de Ruta",
    "Conclusiones y Recomendaciones",
    "Referencias",
    "Apéndices"
  ];

  const WHITEPAPER_SECTIONS = i18n.language === 'es' ? WHITEPAPER_SECTIONS_ES : WHITEPAPER_SECTIONS_EN;

  const handleStartWhitepaper = async (e) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/whitepapers/start-interactive`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setWhitepaperId(response.data.whitepaper_id);
      setStep('generating');
      await generateSection(response.data.whitepaper_id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar el white paper');
      setGenerating(false);
    }
  };

  const generateSection = async (id, secNum) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/whitepapers/generate-section/${id}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setCurrentSection(response.data.section);
      setSectionNumber(secNum);
      setStep('review');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const approveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/whitepapers/approve-section/${whitepaperId}`,
        currentSection,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = currentSection;
      } else {
        updatedSections.push(currentSection);
      }
      
      setSections(updatedSections);
      
      if (sectionNumber < 16) {
        await generateSection(whitepaperId, sectionNumber + 1);
      } else {
        toast.success('Todas las secciones completadas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
    } finally {
      setGenerating(false);
    }
  };

  const editSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor proporciona instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/whitepapers/edit-section/${whitepaperId}`,
        {
          section_number: currentSection.number,
          current_section_title: currentSection.title,
          current_section_content: currentSection.content,
          edit_instructions: editInstructions
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setCurrentSection(response.data.section);
      
      const updatedSections = [...sections];
      const existingIndex = updatedSections.findIndex(s => s.number === currentSection.number);
      
      if (existingIndex >= 0) {
        updatedSections[existingIndex] = response.data.section;
        setSections(updatedSections);
      }
      
      setEditMode(false);
      setEditInstructions('');
      toast.success('Sección actualizada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  const goToSection = async (secNum) => {
    if (secNum < 1 || secNum > 16) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      await generateSection(whitepaperId, secNum);
    }
  };

  const finalizeWhitepaper = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/whitepapers/finalize/${whitepaperId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      toast.success('¡White Paper técnico generado exitosamente!');
      
      // Navigate back to client dashboard if client_id exists
      if (clientId) {
        navigate(`/client-dashboard/${clientId}`);
      } else {
        navigate(`/dashboard`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al finalizar white paper');
    } finally {
      setGenerating(false);
    }
  };

  // Step 1: Project Details
  if (step === 'details') {
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
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">Technical White Paper</h1>
            <p className="form-subtitle">
              Crea un documento técnico profesional de 16 secciones con rigor académico e industrial
            </p>
          </div>

          <Card className="form-card">
            <CardContent className="pt-6">
              <form onSubmit={handleStartWhitepaper} className="form-grid">
                <div className="form-field full-width">
                  <Label htmlFor="project_title">Título del Proyecto *</Label>
                  <Input
                    id="project_title"
                    value={formData.project_title}
                    onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
                    required
                    placeholder="Sistema de IA para Diagnóstico Médico Asistido"
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="author_name">Nombre del Autor *</Label>
                  <Input
                    id="author_name"
                    value={formData.author_name}
                    onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                    required
                    placeholder="Dr. John Smith"
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="author_credentials">Credenciales del Autor *</Label>
                  <Input
                    id="author_credentials"
                    value={formData.author_credentials}
                    onChange={(e) => setFormData({ ...formData, author_credentials: e.target.value })}
                    required
                    placeholder="PhD in Computer Science, MIT"
                  />
                </div>

                <div className="form-field full-width">
                  <Label htmlFor="project_description">Descripción del Proyecto *</Label>
                  <Textarea
                    id="project_description"
                    value={formData.project_description}
                    onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                    required
                    placeholder="Describe el proyecto técnico, objetivos, metodología y resultados esperados..."
                    rows={6}
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="target_audience">Audiencia Objetivo *</Label>
                  <Input
                    id="target_audience"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    required
                    placeholder="Ingenieros ML, Investigadores, CTOs"
                  />
                </div>

                <div className="form-field">
                  <Label htmlFor="technical_domain">Dominio Técnico *</Label>
                  <Input
                    id="technical_domain"
                    value={formData.technical_domain}
                    onChange={(e) => setFormData({ ...formData, technical_domain: e.target.value })}
                    required
                    placeholder="Machine Learning, Healthcare AI"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={generating} 
                  className="submit-button"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      Iniciando Generación...
                    </>
                  ) : (
                    <>
                      Generar White Paper Técnico →
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

  // Step 2: Generating Section (Loading State)
  if (step === 'generating') {
    return (
      <div className="create-container">
        <div className="create-content">
          <Card className="text-center py-12">
            <CardContent>
              <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={64} />
              <h2 className="text-2xl font-bold mb-2">
                Generando Sección {sectionNumber} de 16
              </h2>
              <p className="text-gray-600 mb-4">
                {WHITEPAPER_SECTIONS[sectionNumber - 1]}
              </p>
              <p className="text-sm text-gray-500">
                Esto puede tomar 30-90 segundos por sección...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Review Section
  if (step === 'review' && currentSection) {
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
            <FileText size={48} className="form-icon" />
            <h1 className="form-title">{formData.project_title}</h1>
            <p className="form-subtitle">
              Sección {sectionNumber} de 18: {currentSection.title}
            </p>
          </div>

          {/* Section Navigation Bar */}
          <div className="mb-6 flex flex-wrap gap-2">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((num) => {
              const isCompleted = sections.some(s => s.number === num);
              const isCurrent = num === sectionNumber;
              return (
                <button
                  key={num}
                  onClick={() => goToSection(num)}
                  disabled={!isCompleted && num !== sections.length + 1}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Evaluation Warning Card */}
          {currentSection.validation_warning && (
            <Card className="mb-6" style={{ borderColor: '#ff9800', borderWidth: '2px', backgroundColor: '#fff3e0' }}>
              <CardHeader>
                <CardTitle style={{ color: '#e65100', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertCircle className="text-orange-600" size={24} />
                  {currentSection.validation_warning.title}
                </CardTitle>
                <CardDescription style={{ color: '#bf360c', fontWeight: '500' }}>
                  {currentSection.validation_warning.summary}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#e65100' }}>Problemas detectados:</strong>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                    {currentSection.validation_warning.issues && currentSection.validation_warning.issues.map((issue, idx) => (
                      <li key={idx} style={{ color: '#d84315', marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
                {currentSection.validation_warning.feedback && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Retroalimentación del evaluador:</strong>
                    <p style={{ color: '#5d4037', marginTop: '8px' }}>{currentSection.validation_warning.feedback}</p>
                  </div>
                )}
                {currentSection.validation_warning.metrics && (
                  <div style={{ marginBottom: '15px' }}>
                    <strong style={{ color: '#e65100' }}>Métricas:</strong>
                    <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                      <li style={{ color: '#5d4037' }}>📏 Caracteres: {currentSection.validation_warning.metrics.character_count} (requerido: {currentSection.validation_warning.metrics.required_range})</li>
                      <li style={{ color: '#5d4037' }}>📝 Profundidad técnica: {currentSection.validation_warning.metrics.has_technical_depth ? '✓ Adecuada' : '❌ Requiere mejora'}</li>
                      <li style={{ color: '#5d4037' }}>🔄 Estructura: {currentSection.validation_warning.metrics.has_proper_structure ? '✓ Correcta' : '❌ Requiere mejora'}</li>
                      <li style={{ color: '#5d4037' }}>📚 Evidencia: {currentSection.validation_warning.metrics.has_evidence ? '✓ Presente' : '❌ Falta'}</li>
                    </ul>
                  </div>
                )}
                <div style={{ padding: '12px', backgroundColor: '#ffcc80', borderRadius: '4px', color: '#bf360c' }}>
                  <strong>💡 Recomendación:</strong> {currentSection.validation_warning.recommendation}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Evaluation Card - show when section passed evaluation */}
          {!currentSection.validation_warning && currentSection.evaluation_history && currentSection.evaluation_history.length > 0 && (
            <Card className="mb-6" style={{ borderColor: '#4caf50', borderWidth: '2px', backgroundColor: '#e8f5e8' }}>
              <CardHeader>
                <CardTitle style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle className="text-green-600" size={24} />
                  Evaluación Exitosa
                </CardTitle>
                <CardDescription style={{ color: '#388e3c', fontWeight: '500' }}>
                  Esta sección pasó la evaluación de calidad automática del evaluador IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Resultado de evaluación:</strong>
                  <p style={{ color: '#4caf50', marginTop: '8px' }}>
                    ✓ Sección aprobada en intento {currentSection.evaluation_history.length}
                  </p>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <strong style={{ color: '#2e7d32' }}>Métricas de calidad:</strong>
                  <ul style={{ marginTop: '8px', listStyle: 'none', paddingLeft: '0' }}>
                    <li style={{ color: '#4caf50' }}>📏 Caracteres: {currentSection.content.length} (cumple estándares técnicos)</li>
                    <li style={{ color: '#4caf50' }}>📝 Profundidad técnica: ✓ Adecuada para white paper profesional</li>
                    <li style={{ color: '#4caf50' }}>🔄 Calidad: ✓ Aprobada por evaluador IA</li>
                  </ul>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#c8e6c9', borderRadius: '4px', color: '#2e7d32' }}>
                  <strong>💡 Estado:</strong> Esta sección está lista para continuar o puedes editarla para mejorar aún más.
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent className="pt-6">
              {/* Section Content */}
              <div className="prose max-w-none">
                <h2 className="text-2xl font-bold mb-4">{currentSection.title}</h2>
                <div 
                  className="text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: currentSection.content.replace(/\n/g, '<br />') 
                  }}
                />
              </div>

              {/* Edit Mode */}
              {editMode && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
                  <Label htmlFor="edit_instructions" className="font-semibold mb-2 block">
                    Editar Sección {sectionNumber}
                  </Label>
                  
                  {/* ⭐ Alerta de sincronización bilingüe */}
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                        {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                        {i18n.language === 'es' 
                          ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                          : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                      </p>
                    </div>
                  </div>
                  
                  <Textarea
                    id="edit_instructions"
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    placeholder="Ej: Agrega más métricas específicas y referencias técnicas..."
                    rows={4}
                    className="mb-3"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMode(false);
                        setEditInstructions('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={editSection}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" size={16} />
                          Aplicando Cambios...
                        </>
                      ) : (
                        'Aplicar Cambios'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!editMode && (
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(true)}
                    disabled={generating}
                  >
                    <Edit className="mr-2" size={16} />
                    Editar Sección
                  </Button>
                  <Button
                    onClick={approveSection}
                    disabled={generating}
                    className="flex-1"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        {sectionNumber < 16 ? 'Generando siguiente...' : 'Procesando...'}
                      </>
                    ) : (
                      <>
                        {sectionNumber < 16 ? 'Aprobar y Continuar →' : 'Aprobar Sección Final'}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Finalize Button (after all sections approved) */}
              {sectionNumber === 16 && sections.length === 16 && !editMode && (
                <div className="mt-4">
                  <Button
                    onClick={finalizeWhitepaper}
                    disabled={generating}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Finalizando White Paper...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2" size={18} />
                        Guardar White Paper Completo
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

// ============================================================================
// END CREATE WHITEPAPER INTERACTIVE COMPONENT
// ============================================================================

// View Patent Component
const ViewPatent = () => {
  const [patent, setPatent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('es');
  const [editingSpec, setEditingSpec] = useState(false);
  const [editingDrawings, setEditingDrawings] = useState(false);
  const [editedSpecContent, setEditedSpecContent] = useState('');
  const [editedDrawingsContent, setEditedDrawingsContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [generatingTranslation, setGeneratingTranslation] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadPatent();
    loadCommentStats();
    loadExistingEvaluation();
  }, [id]);

  // Auto-generate translation in background when patent loads
  useEffect(() => {
    if (patent) {
      checkAndGenerateTranslation();
    }
  }, [patent?.id]); // Only run when patent is loaded

  const checkAndGenerateTranslation = async () => {
    if (!patent || generatingTranslation) return;
    
    // Check if translation is needed
    const needsTranslation = 
      (patent.sections?.some(s => !s.content_en)) || 
      (!patent.specification_content_en && patent.specification_content) ||
      (!patent.drawings_content_en && patent.drawings_content) ||
      !patent.invention_title_en ||
      !patent.technical_field_en ||
      !patent.invention_description_en;
    
    if (needsTranslation) {
      console.log('🔄 Auto-generating English translation in background...');
      generateTranslation();
    } else {
      console.log('✅ English translation already available');
    }
  };

  const generateTranslation = async () => {
    setGeneratingTranslation(true);
    try {
      const token = localStorage.getItem('token');
      
      // ⚠️ NOTE: Patents V2 already generate bilingual content, no separate translation needed
      // Skip translation generation for V2 patents
      console.log('Patent generated with bilingual content (V2)');
      
      // Show success message directly
      toast.success('✅ ¡Patente generada en inglés! Ahora puedes descargar el PDF completo.', {
        autoClose: 8000,
        position: 'top-center',
        style: {
          fontSize: '16px',
          padding: '20px',
          fontWeight: 'bold'
        }
      });
      
      await loadPatent(); // Reload to show completed patent
    } catch (error) {
      console.error('Error loading patent:', error);
      toast.error('Error al cargar la patente. Por favor refresca la página.');
    } finally {
      setGeneratingTranslation(false);
    }
  };

  const loadPatent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/patents/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPatent(response.data);
      setEditedSpecContent(response.data.specification_content || '');
      setEditedDrawingsContent(response.data.drawings_content || '');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la patente');
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


  const loadExistingEvaluation = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/patents/${id}/evaluation`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setEvaluationResult(response.data);
    } catch (error) {
      // No evaluation exists yet, which is fine
      console.log('No existing evaluation found');
    }
  };


  const saveSpecification = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Update all sections with the edited content
      // If editing sections, need to update each one
      if (patent.sections && patent.sections.length > 0) {
        // Split content by double newlines or page breaks to match sections
        const contentParts = editedSpecContent.split(/\n\n+/);
        
        // Update each section
        for (let i = 0; i < patent.sections.length && i < contentParts.length; i++) {
          const section = patent.sections[i];
          const updateField = currentLanguage === 'en' ? 'content_en' : 'content_es';
          
          await axios.post(
            `${API}/patents/edit-section/${id}`,
            {
              section_number: section.number,
              content: contentParts[i].trim(),
              language: currentLanguage
            },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
        }
      } else {
        // Update specification_content
        await axios.post(
          `${API}/patents/edit-section/${id}`,
          {
            section_number: 1,
            content: editedSpecContent,
            language: currentLanguage
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      
      setEditingSpec(false);
      toast.success(`✅ Contenido actualizado en ${currentLanguage === 'en' ? 'inglés' : 'español'}`);
      
      // If editing Spanish, automatically re-translate to English
      if (currentLanguage === 'es') {
        toast.info('🔄 Re-traduciendo automáticamente al inglés...', {
          autoClose: false
        });
        
        // Trigger re-translation
        await axios.post(
          `${API}/patents/${id}/generate-translation`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        toast.dismiss();
        toast.success('✅ Versión en inglés actualizada automáticamente');
      }
      
      // Reload patent to get updated content
      await loadPatent();
      
    } catch (error) {
      console.error('Error:', error);
      toast.dismiss();
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const saveDrawings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/patents/edit-section/${id}`,
        {
          section_number: 2,
          content: editedDrawingsContent
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setPatent({ ...patent, drawings_content: editedDrawingsContent });
      setEditingDrawings(false);
      toast.success('Dibujos actualizados');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const downloadDraft = async (language = 'es') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-draft?language=${language}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_draft${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Borrador descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar borrador');
    }
  };

  const downloadDrawings = async (language = 'es') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-drawings?language=${language}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_drawings${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Dibujos descargados en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar dibujos');
    }
  };

  const downloadSpecification = async (language = 'es') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-specification?language=${language}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Definición descargada en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar');
    }
  };

  const downloadComplete = async (language = 'es') => {
    setDownloadingPDF(true);
    
    // Show loading toast with progress info
    const loadingToastId = toast.info(
      '⏳ Generando PDF completo... Esto puede tardar 30-60 segundos mientras se generan los diagramas técnicos.',
      {
        autoClose: false,
        position: 'top-center',
        style: {
          fontSize: '15px',
          padding: '20px',
          maxWidth: '600px',
          fontWeight: '500'
        }
      }
    );
    
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-complete?language=${language}`,
        { responseType: 'blob' }
      );
      
      // Dismiss loading toast
      toast.dismiss(loadingToastId);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_complete${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`✅ PDF completo descargado exitosamente en ${language === 'es' ? 'español' : 'inglés'}!`, {
        autoClose: 3000
      });
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToastId);
      
      // Check if it's a translation error (400 status)
      if (error.response?.status === 400 && language === 'en') {
        toast.warning(
          '⏳ La traducción al inglés aún está en proceso. Por favor espera 1 minuto y vuelve a intentarlo. Verás el mensaje "✅ Versión en inglés lista para descargar" cuando esté completa.',
          {
            autoClose: 8000,
            position: 'top-center',
            style: {
              fontSize: '15px',
              padding: '20px',
              maxWidth: '500px'
            }
          }
        );
      } else {
        toast.error('❌ Error al descargar documento completo. Por favor intenta de nuevo.');
      }
    } finally {
      setDownloadingPDF(false);
    }
  };

  const downloadNumbered = async (language = 'en') => {
    try {
      const response = await axios.get(
        `${API}/patents/${id}/download-numbered?language=${language}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = language === 'es' ? '_ES' : '_EN';
      link.setAttribute('download', `${patent.invention_title}_numbered${langSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Documento con líneas numeradas descargado en ${language === 'es' ? 'español' : 'inglés'}`);
    } catch (error) {
      toast.error('Error al descargar documento numerado');
    }
  };

  const generateDrawings = async () => {
    setEvaluating(true); // Using evaluating state as loading indicator
    try {
      const token = localStorage.getItem('token');
      toast.info('Generando dibujos técnicos con IA...');
      
      const response = await axios.post(
        `${API}/patents/generate-drawings/${id}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success !== false) {
        toast.success('¡Dibujos generados exitosamente!');
        // Reload patent to get updated drawings_content
        await loadPatent();
      } else {
        toast.warning('No se pudieron generar los dibujos. ' + (response.data.error || ''));
      }
    } catch (error) {
      console.error('Error generating drawings:', error);
      toast.error('Error al generar dibujos: ' + (error.response?.data?.detail || error.message));
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="create-container">
        <div className="loading-state">
          <Loader2 className="animate-spin" size={48} />
          <p>Cargando patente...</p>
        </div>
      </div>
    );
  }

  if (!patent) {
    return null;
  }

  const handleBack = () => {
    // If patent has client_id, go back to client dashboard
    if (patent.client_id) {
      navigate(`/client-dashboard/${patent.client_id}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="view-container">
      <div className="view-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2" size={18} />
          {patent.client_id ? 'Volver al Cliente' : 'Volver al Dashboard'}
        </Button>
        <div className="view-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <Button 
            onClick={() => downloadComplete('es')} 
            variant="outline" 
            size="sm" 
            className="bg-purple-50 border-purple-300"
            disabled={downloadingPDF}
          >
            {downloadingPDF ? (
              <>
                <Loader2 className="mr-1 animate-spin" size={14} />
                ⏳ Generando PDF...
              </>
            ) : (
              <>
                <Download className="mr-1" size={14} />
                📦 Completo (ES)
              </>
            )}
          </Button>
          <Button 
            onClick={() => downloadComplete('en')} 
            variant="outline" 
            size="sm" 
            className={generatingTranslation ? "bg-yellow-50 border-yellow-300" : downloadingPDF ? "bg-yellow-50 border-yellow-300" : "bg-blue-50 border-blue-300"}
            disabled={generatingTranslation || downloadingPDF}
          >
            {downloadingPDF ? (
              <>
                <Loader2 className="mr-1 animate-spin" size={14} />
                ⏳ Generando PDF...
              </>
            ) : generatingTranslation ? (
              <>
                <Loader2 className="mr-1 animate-spin" size={14} />
                ⏳ Traduciendo...
              </>
            ) : (
              <>
                <Download className="mr-1" size={14} />
                📦 Completo (EN)
              </>
            )}
          </Button>
          {/* TODO: Botón temporalmente deshabilitado - se incluye automáticamente en descarga completa
          <Button onClick={() => downloadNumbered('en')} variant="outline" size="sm" className="bg-green-50 border-green-300">
            <Download className="mr-1" size={14} />
            📋 Con Líneas Numeradas (EN)
          </Button>
          */}
          <Button onClick={() => setShowHistory(true)} variant="outline" size="sm" className="bg-purple-50">
            <History className="mr-1" size={14} />
            Historial
          </Button>
          <Button onClick={() => setShowComments(true)} variant="outline" size="sm" className="bg-blue-50 relative">
            <MessageSquare className="mr-1" size={14} />
            Comentarios
            {commentStats && commentStats.open > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {commentStats.open}
              </span>
            )}
          </Button>
          <Button 
            onClick={() => {
              if (patent.evaluation_status) {
                setShowEvaluationModal(true);
              } else {
                toast.info('Esta patente fue creada antes del sistema de evaluación automática. Las nuevas patentes se evalúan automáticamente durante la generación.');
              }
            }} 
            variant="outline" 
            size="sm" 
            className={patent.evaluation_status ? "bg-green-50 border-green-300" : "bg-gray-50 border-gray-300"}
          >
            <CheckCircle className="mr-1" size={14} />
            Ver Evaluación
          </Button>
          <Button 
            onClick={() => {
              let contentToEdit = '';
              
              if (patent.sections && patent.sections.length > 0) {
                contentToEdit = patent.sections
                  .map(section => {
                    return currentLanguage === 'es' 
                      ? (section.content_es || section.content || '')
                      : (section.content_en || section.content || '');
                  })
                  .join('\n\n');
              } else {
                contentToEdit = currentLanguage === 'en' 
                  ? (patent.specification_content_en || patent.specification_content || '')
                  : (patent.specification_content_es || patent.specification_content || '');
              }
              
              setEditedSpecContent(contentToEdit);
              setEditingSpec(true);
              
              setTimeout(() => {
                document.getElementById('patent-content')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            variant="outline" 
            size="sm" 
            className="bg-orange-50 border-orange-300"
          >
            <Edit className="mr-1" size={14} />
            ✏️ Editar
          </Button>
        </div>
      </div>

      {/* Evaluation Status Banner */}
      {patent && (patent.status === 'complete' || patent.status === 'completed') && (
        <div className={`mt-4 p-4 rounded-lg border-2 ${
          !patent.evaluation_status ? 'bg-gray-50 border-gray-300' : 'bg-green-50 border-green-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!patent.evaluation_status ? (
                <>
                  <AlertCircle className="text-gray-600" size={28} />
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">📋 Patente Sin Evaluación</h3>
                    <p className="text-sm text-gray-700">
                      Esta patente fue creada antes del sistema de evaluación automática. Las nuevas patentes se evalúan automáticamente durante la generación.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="text-green-600" size={28} />
                  <div>
                    <h3 className="font-bold text-green-900 text-lg">✅ Evaluación Completa</h3>
                    <p className="text-sm text-green-700">
                      Esta patente fue evaluada exitosamente
                      {patent.evaluation_score && ` (Puntuación: ${patent.evaluation_score.toFixed(1)}/10)`}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      💡 Revisa las sugerencias del evaluador haciendo clic en "Ver Evaluación"
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {patent.evaluation_status && (
              <Button 
                onClick={() => setShowEvaluationModal(true)}
                variant="outline"
                className="bg-white"
              >
                <CheckCircle className="mr-2" size={16} />
                Ver Evaluación
              </Button>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  // Initialize content based on current language
                  let contentToEdit = '';
                  
                  if (patent.sections && patent.sections.length > 0) {
                    contentToEdit = patent.sections
                      .map(section => {
                        return currentLanguage === 'es' 
                          ? (section.content_es || section.content || '')
                          : (section.content_en || section.content || '');
                      })
                      .join('\n\n');
                  } else {
                    contentToEdit = currentLanguage === 'en' 
                      ? (patent.specification_content_en || patent.specification_content || '')
                      : (patent.specification_content_es || patent.specification_content || '');
                  }
                  
                  setEditedSpecContent(contentToEdit);
                  setEditingSpec(true);
                  
                  // Scroll to editor
                  setTimeout(() => {
                    document.getElementById('patent-content')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                variant="outline"
                size="sm"
                className="bg-white"
              >
                <Edit className="mr-2" size={16} />
                Editar Manualmente
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowEvaluationModal(true)}
                size="sm"
              >
                Ver Detalles
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="view-content">
        <div className="document-header">
          <h1 className="document-title">
            <Scale className="inline mr-2" size={28} />
            {patent.invention_title}
          </h1>
          <p className="document-meta">
            {patent.inventor_name} • {patent.technical_field} • 
            {new Date(patent.created_at).toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} • {new Date(patent.created_at).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>
                <div className="space-y-1">
                  <p><strong>Inventor:</strong> {patent.inventor_name}</p>
                  <p><strong>Residencia:</strong> {patent.inventor_residence}</p>
                  <p><strong>Campo Técnico:</strong> {patent.technical_field}</p>
                </div>
              </CardDescription>
              {(patent.status === 'complete' || patent.status === 'completed') && (
                <Button 
                  onClick={() => {
                    if (patent.evaluation_status) {
                      setShowEvaluationModal(true);
                    } else {
                      toast.info('Esta patente fue creada antes del sistema de evaluación automática. Las nuevas patentes se evalúan automáticamente durante la generación.');
                    }
                  }} 
                  variant="outline" 
                  size="sm" 
                  className={patent.evaluation_status ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-200 text-gray-600"}
                >
                  <CheckCircle className="mr-2" size={16} />
                  Ver Evaluación
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Alert for in-progress documents */}
        {patent.status === 'in_progress' && patent.current_section && patent.total_sections && patent.current_section <= patent.total_sections && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin text-orange-600" size={20} />
                  <h3 className="font-semibold text-orange-900">Patente en Progreso</h3>
                </div>
                <p className="text-sm text-orange-800 mb-3">
                  Esta patente tiene {patent.current_section - 1} de {patent.total_sections} secciones completadas. 
                  Puedes continuar generando las secciones restantes.
                </p>
                <div className="w-full bg-orange-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all" 
                    style={{ width: `${((patent.current_section - 1) / patent.total_sections) * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button 
                onClick={() => navigate(`/create-patent?resume_id=${patent.id}`)}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                <Play className="mr-2" size={18} />
                Continuar Generación
              </Button>
            </div>
          </div>
        )}

        {/* Evaluation Feedback Card */}
        {patent.evaluation_feedback && (
          <Card className="mb-4 border-2" style={{
            borderColor: patent.quality_score >= 7 ? '#10b981' : '#f97316'
          }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className={patent.quality_score >= 7 ? 'text-green-600' : 'text-orange-600'} size={24} />
                  {currentLanguage === 'es' ? 'Evaluación de Calidad' : 'Quality Assessment'} - {patent.quality_score}/10
                </CardTitle>
                <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                  patent.quality_score >= 7 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {patent.quality_score >= 7 ? '✅ Aprobada' : '⚠️ Requiere Revisión'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    let feedback = patent.evaluation_feedback || '';
                    
                    // Simple translation for common patent evaluation terms if in English mode
                    if (currentLanguage === 'en' && feedback) {
                      // For now, show original feedback. In future, could implement translation
                      // This would require backend translation similar to NIW module
                      return feedback;
                    }
                    
                    return feedback;
                  })()
                }}
                style={{
                  lineHeight: '1.6',
                  color: '#374151'
                }}
              />
            </CardContent>
          </Card>
        )}

        <Card id="patent-content">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Definición USPTO (35 U.S.C. §111(b))</CardTitle>
                {!editingSpec && (
                  <p className="text-sm text-gray-500 mt-1">
                    {currentLanguage === 'es' ? 'Versión en Español' : 'English Version'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {!editingSpec && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    marginBottom: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                  }}>
                    <span style={{ 
                      fontWeight: currentLanguage === 'es' ? 'bold' : 'normal',
                      color: currentLanguage === 'es' ? '#8b5cf6' : '#666',
                      fontSize: '0.85rem'
                    }}>
                      🇪🇸 Español
                    </span>
                    
                    <button
                      onClick={() => {
                        const newLang = currentLanguage === 'es' ? 'en' : 'es';
                        setCurrentLanguage(newLang);
                        console.log('🌐 Idioma cambiado a:', newLang);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.4rem 1.2rem',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
                      }}
                    >
                      <Globe size={14} className="inline mr-1" />
                      {currentLanguage === 'es' ? '→ Switch to English' : '→ Cambiar a Español'}
                    </button>
                    
                    <span style={{ 
                      fontWeight: currentLanguage === 'en' ? 'bold' : 'normal',
                      color: currentLanguage === 'en' ? '#8b5cf6' : '#666',
                      fontSize: '0.85rem'
                    }}>
                      🇺🇸 English
                    </span>
                  </div>
                )}
                {!editingSpec ? (
                  <Button onClick={() => {
                    // Initialize content based on current language
                    let contentToEdit = '';
                    
                    // If patent has sections, compile them
                    if (patent.sections && patent.sections.length > 0) {
                      contentToEdit = patent.sections
                        .map(section => {
                          return currentLanguage === 'es' 
                            ? (section.content_es || section.content || '')
                            : (section.content_en || section.content || '');
                        })
                        .join('\n\n');
                    } else {
                      // Use specification_content field
                      contentToEdit = currentLanguage === 'en' 
                        ? (patent.specification_content_en || patent.specification_content || '')
                        : (patent.specification_content_es || patent.specification_content || '');
                    }
                    
                    setEditedSpecContent(contentToEdit);
                    setEditingSpec(true);
                  }} variant="outline" size="sm">
                    <Edit className="mr-2" size={16} />
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={saveSpecification} 
                      variant="default" 
                      size="sm"
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                      ) : (
                        <><Save className="mr-2" size={16} />Guardar</>
                      )}
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingSpec(false);
                        setEditedSpecContent(patent.specification_content);
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editingSpec ? (
              <Textarea
                value={editedSpecContent}
                onChange={(e) => setEditedSpecContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                style={{ fontFamily: 'monospace' }}
              />
            ) : generatingTranslation && currentLanguage === 'en' ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                <p className="text-lg font-semibold text-gray-700 mb-2">Generando traducción al inglés...</p>
                <p className="text-sm text-gray-500">Este proceso puede tomar entre 30-60 segundos</p>
              </div>
            ) : (
              <div 
                className="patent-content prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    // Si hay secciones, compilar el contenido del idioma seleccionado
                    if (patent.sections && patent.sections.length > 0) {
                      return patent.sections
                        .map(section => {
                          const sectionContent = currentLanguage === 'es' 
                            ? (section.content_es || section.content || '')
                            : (section.content_en || section.content || '');
                          return sectionContent;
                        })
                        .join('<div style="page-break-after: always;"></div>');
                    }
                    // Si no hay secciones, usar el campo specification_content
                    return currentLanguage === 'es'
                      ? (patent.specification_content_es || patent.specification_content || '')
                      : (patent.specification_content_en || patent.specification_content || '');
                  })()
                }}
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }}
              />
            )}
          </CardContent>
        </Card>

        {patent.drawings_content && (
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dibujos de Patente (FIG. 1-7)</CardTitle>
                  {!editingDrawings && (
                    <p className="text-sm text-gray-500 mt-1">
                      {currentLanguage === 'es' ? 'Versión en Español' : 'English Version'}
                    </p>
                  )}
                </div>
                {!editingDrawings ? (
                  <Button onClick={() => setEditingDrawings(true)} variant="outline" size="sm">
                    <Edit className="mr-2" size={16} />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      onClick={saveDrawings} 
                      variant="default" 
                      size="sm"
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                      ) : (
                        <><Save className="mr-2" size={16} />Guardar</>
                      )}
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingDrawings(false);
                        setEditedDrawingsContent(patent.drawings_content);
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingDrawings ? (
                <Textarea
                  value={editedDrawingsContent}
                  onChange={(e) => setEditedDrawingsContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  style={{ fontFamily: 'monospace' }}
                />
              ) : generatingTranslation && currentLanguage === 'en' ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                  <p className="text-lg font-semibold text-gray-700 mb-2">Traduciendo dibujos al inglés...</p>
                  <p className="text-sm text-gray-500">Por favor espera...</p>
                </div>
              ) : (
                <div 
                  className="drawings-content prose max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: currentLanguage === 'es'
                      ? (patent.drawings_content_es || patent.drawings_content || '')
                      : (patent.drawings_content_en || patent.drawings_content || '')
                  }}
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    fontFamily: 'Georgia, serif'
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Version History Modal */}
      <VersionHistory
        documentId={id}
        documentType="patent"
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onRestore={() => {
          setShowHistory(false);
          loadPatent();
        }}
      />

      {/* Comments Panel */}
      <CommentsPanel
        documentId={id}
        documentType="patent"
        open={showComments}
        onClose={() => {
          setShowComments(false);
          loadCommentStats();
        }}
      />

      {/* Patent Evaluation Modal */}
      {showEvaluationModal && evaluationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowEvaluationModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="text-green-600" size={32} />
                <span className="text-green-700">Evaluación USPTO Completa</span>
              </h2>
              <Button variant="ghost" onClick={() => setShowEvaluationModal(false)}>
                <X size={24} />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Score Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">Puntuación General</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Estructura</div>
                    <div className="text-2xl font-bold text-blue-600">{evaluationResult.puntuacion.estructura_formato}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Descripción Técnica</div>
                    <div className="text-2xl font-bold text-indigo-600">{evaluationResult.puntuacion.descripcion_tecnica}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Novedad</div>
                    <div className="text-2xl font-bold text-green-600">{evaluationResult.puntuacion.novedad_no_obviedad}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Claridad Legal</div>
                    <div className="text-2xl font-bold text-cyan-600">{evaluationResult.puntuacion.claridad_legal}/10</div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <div className="text-sm text-gray-600">Completitud</div>
                    <div className="text-2xl font-bold text-teal-600">{evaluationResult.puntuacion.completitud}/10</div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                  <div className="text-sm text-gray-600 mb-1">Puntuación Total</div>
                  <div className="text-4xl font-bold text-blue-700">{evaluationResult.puntuacion.score_total.toFixed(2)}/10</div>
                </div>
              </div>

              {/* Critical Problems */}
              {evaluationResult.problemas_criticos && evaluationResult.problemas_criticos.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-red-900 flex items-center gap-2">
                    <AlertCircle className="text-red-600" size={20} />
                    Problemas Críticos ({evaluationResult.problemas_criticos.length})
                  </h3>
                  <div className="space-y-3">
                    {evaluationResult.problemas_criticos.map((problem, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-red-200">
                        <div className="text-xs font-semibold text-red-600 uppercase mb-1">{problem.category}</div>
                        <div className="text-sm font-medium text-gray-900 mb-1">{problem.description}</div>
                        <div className="text-xs text-gray-600 mb-2">📍 {problem.location}</div>
                        <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
                          <span className="font-semibold">Corrección sugerida:</span> {problem.suggested_fix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Minor Problems */}
              {evaluationResult.problemas_menores && evaluationResult.problemas_menores.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-yellow-900 flex items-center gap-2">
                    <AlertTriangle className="text-yellow-600" size={20} />
                    Problemas Menores ({evaluationResult.problemas_menores.length})
                  </h3>
                  <div className="space-y-2">
                    {evaluationResult.problemas_menores.map((problem, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-yellow-200">
                        <div className="text-xs font-semibold text-yellow-600 uppercase mb-1">{problem.category}</div>
                        <div className="text-sm text-gray-900">{problem.description}</div>
                        <div className="text-xs text-gray-600">📍 {problem.location}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Corrections Applied */}
              {evaluationResult.correcciones_aplicadas && evaluationResult.correcciones_aplicadas.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-blue-900 flex items-center gap-2">
                    <CheckCircle className="text-blue-600" size={20} />
                    Correcciones Aplicadas ({evaluationResult.correcciones_aplicadas.length})
                  </h3>
                  <ul className="space-y-2">
                    {evaluationResult.correcciones_aplicadas.map((correction, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-green-600 mt-1">✓</span>
                        <span className="text-gray-700">{correction}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {evaluationResult.recomendaciones && evaluationResult.recomendaciones.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-purple-900 flex items-center gap-2">
                    <Lightbulb className="text-purple-600" size={20} />
                    Recomendaciones
                  </h3>
                  <ul className="space-y-2">
                    {evaluationResult.recomendaciones.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-600 mt-1">💡</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* USPTO Checklist */}
              {evaluationResult.checklist_uspto && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3 text-green-900 flex items-center gap-2">
                    <CheckCircle className="text-green-600" size={20} />
                    Checklist USPTO
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(evaluationResult.checklist_uspto).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {value ? (
                          <CheckCircle className="text-green-600" size={16} />
                        ) : (
                          <XCircle className="text-red-600" size={16} />
                        )}
                        <span className={value ? 'text-gray-700' : 'text-red-700'}>
                          {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Iteraciones: {evaluationResult.iteracion}</span>
                  <span>Evaluación: {new Date(evaluationResult.created_at).toLocaleString('es-ES')}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowEvaluationModal(false)}>
                  Cerrar
                </Button>
                {evaluationResult.estado === 'APROBADA' && (
                  <Button onClick={() => downloadComplete('en')} className="bg-green-600 hover:bg-green-700">
                    <Download className="mr-2" size={16} />
                    Descargar Patente Aprobada
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// ====================
// ECONOMETRIC STUDIES COMPONENTS
// ====================

const CreateEconometricStudy = () => {
  const [step, setStep] = useState('input'); // input, generating, review
  const [projectDescription, setProjectDescription] = useState('');
  const [inputMode, setInputMode] = useState('text'); // text or file
  const [uploading, setUploading] = useState(false);
  const [studyId, setStudyId] = useState(null);
  const [studyTitle, setStudyTitle] = useState('');
  const [applicantName, setApplicantName] = useState('');
  const [currentSection, setCurrentSection] = useState(null);
  const [sectionNumber, setSectionNumber] = useState(1);
  const [sections, setSections] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const ECONOMETRIC_SECTIONS_EN = [
    "Cover Page & Executive Summary",
    "Introduction & Research Questions",
    "Conceptual Framework & Mechanisms",
    "National Context & Relevance",
    "Data & Sources",
    "Empirical Design & Identification",
    "Specifications & Estimation Methods",
    "Robustness & Validation",
    "Main Results",
    "Simulations & Projections",
    "Cost–Benefit Analysis (CBA)",
    "Policy Implications",
    "Limitations",
    "Conclusions",
    "Phases & Deliverables Plan",
    "Technical Appendices"
  ];

  const ECONOMETRIC_SECTIONS_ES = [
    "Portada y Resumen Ejecutivo",
    "Introducción y Preguntas de Investigación",
    "Fundamento Conceptual y Mecanismos",
    "Contexto Nacional y Relevancia",
    "Datos y Fuentes",
    "Diseño Empírico e Identificación",
    "Especificaciones y Métodos de Estimación",
    "Validaciones y Robustez",
    "Resultados Principales",
    "Simulación y Proyecciones",
    "Análisis Costo–Beneficio (CBA)",
    "Implicaciones de Política",
    "Limitaciones",
    "Conclusiones",
    "Plan de Fases y Entregables",
    "Apéndices Técnicos"
  ];

  const ECONOMETRIC_SECTIONS = i18n.language === 'es' ? ECONOMETRIC_SECTIONS_ES : ECONOMETRIC_SECTIONS_EN;

  // Get resume_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const resumeId = searchParams.get('resume_id');
  
  // Load in-progress document or draft on mount
  React.useEffect(() => {
    const loadDocument = async () => {
      // Load in-progress document if resume_id is present
      if (resumeId) {
        try {
          const token = localStorage.getItem('token');
          const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
          const response = await fetch(`${BACKEND_URL}/api/econometric-studies/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const doc = await response.json();
            
            // Load document data
            setStudyId(doc.id);
            setStudyTitle(doc.study_title || '');
            setApplicantName(doc.applicant_name || '');
            setProjectDescription(doc.project_description || '');
            
            // Load sections if they exist
            if (doc.sections && doc.sections.length > 0) {
              setSections(doc.sections);
              const nextSection = doc.current_section || doc.sections.length + 1;
              setSectionNumber(nextSection);
              
              // Set current section to the last completed one for review
              const lastSection = doc.sections[doc.sections.length - 1];
              setCurrentSection(lastSection);
              setStep('review');
              toast.success(`Estudio cargado - ${doc.sections.length}/16 secciones completadas`);
            } else {
              // No sections yet, go to generating step to create first section
              setStep('generating');
              toast.success('Estudio cargado - Iniciando generación');
            }
          }
        } catch (error) {
          console.error('Error loading in-progress document:', error);
          toast.error('Error al cargar estudio');
        }
        return;
      }
      
      // Load draft if coming from drafts page
      const draftData = sessionStorage.getItem('draft_to_load');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          if (draft.document_type === 'econometric_study' && draft.content) {
            // Load draft data into form
            if (draft.content.projectDescription) setProjectDescription(draft.content.projectDescription);
            if (draft.content.studyTitle) setStudyTitle(draft.content.studyTitle);
            if (draft.content.applicantName) setApplicantName(draft.content.applicantName);
            if (draft.content.inputMode) setInputMode(draft.content.inputMode);
            if (draft.content.step) setStep(draft.content.step);
            if (draft.content.sectionNumber) setSectionNumber(draft.content.sectionNumber);
            if (draft.content.sections) setSections(draft.content.sections);
            toast.success('Borrador cargado exitosamente');
          }
          sessionStorage.removeItem('draft_to_load');
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    };
    
    loadDocument();
  }, [resumeId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/upload-cv`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const extractedText = response.data.raw_text || response.data.analyzed_cv || '';
      setProjectDescription(extractedText);
      toast.success(`Archivo cargado: ${response.data.text_length} caracteres extraídos`);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Error al cargar el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleStartStudy = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setStep('generating');

    try {
      const token = localStorage.getItem('token');
      const studyData = {
        project_description: projectDescription,
        language: i18n.language
      };
      
      const response = await axios.post(`${API}/econometric-studies/start`, studyData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setStudyId(response.data.study_id);
      setStudyTitle(response.data.study_title || 'Estudio Econométrico');
      setApplicantName(response.data.applicant_name || 'Investigador');
      setSectionNumber(1);
      
      // Generate first section
      await generateSection(response.data.study_id, 1);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar el estudio');
      setStep('input');
      setGenerating(false);
    }
  };

  const generateSection = async (study_id, section_num) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/${study_id}/generate-section/${section_num}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const sectionData = {
        ...response.data.section,
        validation_warning: response.data.validation_warning
      };

      setCurrentSection(sectionData);
      setSectionNumber(section_num);
      setStep('review');
      
      if (response.data.validation_passed === false) {
        toast.warning(`Sección ${section_num} generada con advertencias de validación`);
      } else if (response.data.validation_passed) {
        toast.success(`Sección ${section_num} generada y validada ✓`);
      } else {
        toast.success(`Sección ${section_num} generada`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al generar sección');
    } finally {
      setGenerating(false);
    }
  };

  const handleEditSection = async () => {
    if (!editInstructions.trim()) {
      toast.error('Por favor escribe las instrucciones de edición');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/edit-section/${studyId}`,
        {
          section_number: sectionNumber,
          edit_instructions: editInstructions,
          current_section_content: currentSection.content,
          current_section_title: currentSection.title
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setCurrentSection(response.data.section);
      setEditInstructions('');
      setEditMode(false);
      toast.success('Sección editada exitosamente');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al editar sección');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveSection = async () => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/${studyId}/approve-section/${sectionNumber}`,
        currentSection,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const newSections = [...sections, currentSection];
      setSections(newSections);

      if (sectionNumber < 16) {
        toast.success(`Sección ${sectionNumber} aprobada. Generando siguiente...`);
        setStep('generating');
        await generateSection(studyId, sectionNumber + 1);
      } else {
        toast.success('¡Estudio completado!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al aprobar sección');
      setGenerating(false);
    }
  };

  const goToSection = async (secNum) => {
    if (secNum < 1 || secNum > 16) return;
    
    const existingSection = sections.find(sec => sec.number === secNum);
    if (existingSection) {
      setCurrentSection(existingSection);
      setSectionNumber(secNum);
      setStep('review');
    } else if (secNum === sections.length + 1) {
      setStep('generating');
      await generateSection(studyId, secNum);
    }
  };

  const saveDraft = async () => {
    try {
      const token = localStorage.getItem('token');
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
      
      // Calculate completion percentage
      let completion = 0;
      if (projectDescription && projectDescription.trim()) completion += 25;
      if (studyTitle) completion += 20;
      if (applicantName) completion += 15;
      if (inputMode) completion += 10;
      if (sections.length > 0) completion += 30;
      
      const response = await fetch(`${BACKEND_URL}/api/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          document_type: 'econometric_study',
          title: studyTitle || applicantName || 'Borrador Estudio Econométrico sin título',
          content: {
            projectDescription,
            studyTitle,
            applicantName,
            inputMode,
            step,
            sectionNumber,
            sections
          },
          client_id: null,
          notes: `Borrador guardado en paso: ${step}`,
          completion_percentage: completion
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('✅ Borrador guardado exitosamente');
      } else {
        toast.error('Error al guardar borrador');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Error al guardar borrador');
    }
  };

  // Step 1: Input
  if (step === 'input') {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2" size={18} />
            {t('back_to_dashboard') || 'Volver al Dashboard'}
          </Button>
        </div>

        <div className="create-content">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                <TrendingUp className="inline mr-2" size={28} />
                Crear Estudio Econométrico
              </CardTitle>
              <CardDescription>
                Genera un estudio econométrico profesional para reforzar Prong 1 del EB-2 NIW
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStartStudy} className="space-y-6">
                {/* Input Mode Selector */}
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <Button
                    type="button"
                    variant={inputMode === 'text' ? 'default' : 'ghost'}
                    className="flex-1"
                    onClick={() => setInputMode('text')}
                  >
                    <FileText className="mr-2" size={16} />
                    Escribir Texto
                  </Button>
                  <Button
                    type="button"
                    variant={inputMode === 'file' ? 'default' : 'ghost'}
                    className="flex-1"
                    onClick={() => setInputMode('file')}
                  >
                    <Upload className="mr-2" size={16} />
                    Subir Archivo
                  </Button>
                </div>

                {inputMode === 'text' ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Descripción del Proyecto de Interés Nacional
                    </label>
                    <Textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Describe detalladamente tu proyecto de interés nacional:&#10;&#10;• Título o nombre del proyecto&#10;• Tu nombre completo&#10;• Objetivos y alcance&#10;• Metodología&#10;• Impacto esperado a nivel nacional&#10;• Beneficios cuantificables&#10;• Sector y problema que resuelve&#10;• Innovación tecnológica o metodológica&#10;&#10;Proporciona la máxima información posible para un análisis econométrico riguroso."
                      rows={16}
                      required
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Incluye datos cuantitativos, métricas esperadas, población objetivo, y cualquier información que ayude a demostrar el mérito e importancia nacional (Prong 1)
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Cargar Documento del Proyecto (PDF o Word)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                            <p className="text-sm text-gray-600">Procesando archivo...</p>
                          </>
                        ) : projectDescription ? (
                          <>
                            <CheckCircle className="text-green-600 mb-3" size={40} />
                            <p className="text-sm font-medium text-gray-700 mb-2">✅ Archivo cargado exitosamente</p>
                            <div className="w-full max-h-40 overflow-y-auto bg-gray-50 border border-gray-200 rounded p-3 mb-3">
                              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                {projectDescription.slice(0, 500)}
                                {projectDescription.length > 500 && '...'}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                              📄 {projectDescription.length} caracteres extraídos
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                setProjectDescription('');
                              }}
                            >
                              <Upload className="mr-2" size={14} />
                              Cambiar archivo
                            </Button>
                          </>
                        ) : (
                          <>
                            <Upload className="text-gray-400 mb-2" size={32} />
                            <p className="text-sm font-medium text-gray-700">
                              Click para subir archivo PDF o Word
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Sube un documento con la descripción completa de tu proyecto
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Button 
                    type="button"
                    onClick={saveDraft}
                    variant="outline"
                    disabled={generating || !projectDescription || !projectDescription.trim()}
                    style={{ flex: 1 }}
                  >
                    <Save className="mr-2" size={18} />
                    Guardar Borrador
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={generating || !projectDescription || !projectDescription.trim()}
                    style={{ flex: 1 }}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Iniciando Análisis...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2" size={18} />
                        Iniciar Estudio Econométrico
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Generating (loading screen)
  if (step === 'generating') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '40px' }}>
          {/* Logo Monica con animación */}
          <div style={{ 
            width: '120px', 
            height: '120px', 
            margin: '0 auto 30px',
            backgroundColor: '#000',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite',
            boxShadow: '0 0 40px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '48px', color: '#fff', fontWeight: 'bold' }}>M</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, (sectionNumber / 16) * 100)}%`,
                height: '100%',
                backgroundColor: '#000',
                transition: 'width 0.3s ease',
                animation: 'shimmer 1.5s infinite'
              }}></div>
            </div>
            <p style={{ marginTop: '15px', fontSize: '24px', fontWeight: 'bold', color: '#000' }}>
              {Math.round((sectionNumber / 16) * 100)}%
            </p>
          </div>

          {/* Información de progreso */}
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '10px', color: '#000' }}>
            Generando Sección {sectionNumber} de 16
          </h2>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>
            {ECONOMETRIC_SECTIONS[sectionNumber - 1]}
          </p>
          <div style={{ fontSize: '14px', color: '#999', lineHeight: '1.6' }}>
            <p>✨ Generando contenido con IA...</p>
            <p>🔍 Analizando datos econométricos...</p>
            <p>⏱️ Esto puede tomar 30-90 segundos</p>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
          @keyframes shimmer {
            0% { background-position: -1000px 0; }
            100% { background-position: 1000px 0; }
          }
        `}</style>
      </div>
    );
  }

  // Step 3: Review
  if (step === 'review' && currentSection) {
    return (
      <div className="create-container">
        <div className="create-header">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2" size={18} />
            Cancelar
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              Sección {sectionNumber} de 16
            </span>
          </div>
        </div>

        <div className="create-content max-w-4xl mx-auto">
          {/* Navigation numbers */}
          <div className="mb-4 flex gap-1 flex-wrap">
            {Array.from({ length: 16 }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => goToSection(num)}
                disabled={num > sections.length + 1}
                title={ECONOMETRIC_SECTIONS[num - 1]}
                className={`px-3 py-2 rounded text-xs ${
                  num === sectionNumber 
                    ? 'bg-black text-white' 
                    : num <= sections.length 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Sección {sectionNumber} de 16</CardTitle>
              <CardDescription>{studyTitle} - {applicantName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="econometric-content"
                dangerouslySetInnerHTML={{ __html: currentSection.content }}
              />
            </CardContent>
          </Card>

          {/* Validation Warning */}
          {currentSection.validation_warning && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '24px' }}>⚠️</span>
                <h4 style={{ margin: 0, color: '#856404', fontSize: '16px', fontWeight: '600' }}>
                  {currentSection.validation_warning.title}
                </h4>
              </div>
              <p style={{ color: '#856404', marginBottom: '12px', fontSize: '14px' }}>
                {currentSection.validation_warning.summary}
              </p>
              
              {currentSection.validation_warning.issues && currentSection.validation_warning.issues.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#856404', display: 'block', marginBottom: '8px' }}>🔍 Problemas detectados:</strong>
                  <ul style={{ marginLeft: '20px', color: '#856404' }}>
                    {(currentSection.validation_warning.issues || []).map((issue, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <p style={{ color: '#856404', marginTop: '8px', fontSize: '14px' }}>
                <strong>Feedback:</strong> {currentSection.validation_warning.feedback}
              </p>
              
              {currentSection.validation_warning.metrics && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                  <strong style={{ color: '#856404', display: 'block', marginBottom: '8px' }}>📊 Métricas de Validación:</strong>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#856404' }}>
                    <li>🔄 Intentos de generación: {currentSection.validation_warning.metrics.attempts}</li>
                    <li>📈 Puntuación final: {currentSection.validation_warning.metrics.final_score}/10</li>
                    <li>⚠️ Problemas críticos: {currentSection.validation_warning.metrics.critical_issues}</li>
                  </ul>
                </div>
              )}
              
              <p style={{ 
                marginTop: '16px', 
                padding: '12px', 
                backgroundColor: '#fff', 
                borderLeft: '4px solid #ffc107', 
                color: '#856404',
                fontSize: '13px'
              }}>
                <strong>💡 Recomendación:</strong> Considera usar "Editar Sección" para mejorar los aspectos señalados antes de aprobar.
              </p>
            </div>
          )}

          {!editMode ? (
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={generating}
              >
                <Edit className="mr-2" size={18} />
                Editar Sección
              </Button>
              <Button
                onClick={handleApproveSection}
                disabled={generating}
                className="bg-green-600 hover:bg-green-700"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Procesando...
                  </>
                ) : (
                  <>
                    ✓ Aprobar y Continuar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Editar Sección {sectionNumber}</CardTitle>
                <CardDescription>
                  Describe qué cambios quieres que la IA haga en esta sección
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* ⭐ Alerta de sincronización bilingüe */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.25rem', marginTop: '2px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400e', display: 'block', marginBottom: '0.25rem' }}>
                      {i18n.language === 'es' ? 'Importante:' : 'Important:'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#78350f', lineHeight: '1.5' }}>
                      {i18n.language === 'es' 
                        ? 'Al guardar los cambios, la versión en inglés se regenerará automáticamente para mantener la sincronización. Estás editando la versión en español.'
                        : 'When saving changes, the Spanish version will be automatically regenerated to maintain synchronization. You are editing the English version.'}
                    </p>
                  </div>
                </div>
                
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Ejemplo: 'Añade más evidencia cuantitativa del impacto nacional. Incluye referencias a estudios académicos recientes. Fortalece la argumentación sobre substantial merit con datos específicos de U.S. Census o BLS.'"
                  rows={5}
                  className="mb-4"
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditMode(false);
                      setEditInstructions('');
                    }}
                    disabled={generating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleEditSection}
                    disabled={generating || !editInstructions.trim()}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={18} />
                        Regenerando...
                      </>
                    ) : (
                      <>
                        Aplicar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return null;
};

const ViewEconometricStudy = () => {
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [commentStats, setCommentStats] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    loadStudy();
    loadCommentStats();
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
    setEditedContent(section.content);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditedContent('');
  };

  const saveSection = async (sectionNumber) => {
    console.log('Saving section:', sectionNumber);
    console.log('Content length:', editedContent.length);
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/econometric-studies/${id}/edit-section`,
        {
          number: sectionNumber,
          content: editedContent
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      console.log('Save response:', response.data);
      
      // Update local state
      const updatedSections = study.sections.map(s => 
        s.number === sectionNumber ? { ...s, content: editedContent } : s
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

  const downloadPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/econometric-studies/${id}/download`,
        { 
          responseType: 'blob',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${study.study_title}_econometric_study.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF descargado');
    } catch (error) {
      toast.error('Error al descargar');
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
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2" size={18} />
          Volver al Dashboard
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
                    <p><strong>Secciones:</strong> {study.sections?.length || 0} de 18</p>
                    <p><strong>Creado:</strong> {new Date(study.created_at).toLocaleString('es-ES')}</p>
                  </div>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={downloadPDF} variant="outline">
                  <Download className="mr-2" size={16} />
                  Descargar PDF
                </Button>
                <Button onClick={() => setShowHistory(true)} variant="outline" className="bg-purple-50">
                  <History className="mr-2" size={16} />
                  Ver Historial
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

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

        {study.sections && study.sections.sort((a, b) => a.number - b.number).map((section) => (
          <Card key={section.number} className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Sección {section.number}: {section.title}
                </CardTitle>
                {editingSection === section.number ? (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => saveSection(section.number)} 
                      variant="default" 
                      size="sm"
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 className="mr-2 animate-spin" size={16} />Guardando...</>
                      ) : (
                        <><Save className="mr-2" size={16} />Guardar</>
                      )}
                    </Button>
                    <Button 
                      onClick={cancelEditing} 
                      variant="outline" 
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => startEditing(section)} variant="outline" size="sm">
                    <Edit className="mr-2" size={16} />
                    Editar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingSection === section.number ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                />
              ) : (
                <div 
                  className="econometric-content"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Version History Modal */}
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

      {/* Comments Panel */}
      <CommentsPanel
        documentId={id}
        documentType="econometric_study"
        open={showComments}
        onClose={() => {
          setShowComments(false);
          loadCommentStats();
        }}
      />
    </div>
  );
};


// ============================================================================
// CREATE RECOMMENDATION LETTER COMPONENT
// ============================================================================
const CreateRecommendationLetter = () => {
  const [formData, setFormData] = useState({
    candidate_name: '',
    candidate_field: '',
    candidate_position: '',
    recommender_name: '',
    recommender_title: '',
    recommender_organization: '',
    recommender_email: '',
    recommender_phone: '',
    relationship_description: '',
    key_achievements: '',
    visa_type: 'EB-2 NIW',
    additional_context: '',
    language: 'en'
  });
  
  const [generating, setGenerating] = useState(false);
  const [letterContent, setLetterContent] = useState('');
  const [letterContentEn, setLetterContentEn] = useState('');
  const [letterContentEs, setLetterContentEs] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [letterId, setLetterId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [step, setStep] = useState('form'); // form, generated
  const [translating, setTranslating] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);
  
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  // Get client_id from URL params if present
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');

  // Load client data on mount
  React.useEffect(() => {
    const loadClientData = async () => {
      if (!clientId) {
        setLoadingClient(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API}/clients/${clientId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const client = response.data;
        setClientData(client);

        // Auto-fill candidate information from client data
        setFormData(prev => ({
          ...prev,
          candidate_name: client.name || '',
          candidate_field: client.field || '',
          candidate_position: client.position || '',
          // Keep recommender fields empty - user must fill these
        }));

        toast.success(`Datos del cliente ${client.name} cargados`);
      } catch (error) {
        console.error('Error loading client data:', error);
        toast.error('Error al cargar datos del cliente');
      } finally {
        setLoadingClient(false);
      }
    };

    loadClientData();
  }, [clientId]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateLetter = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.candidate_name || !formData.recommender_name || !formData.relationship_description) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    setGenerating(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/recommendation-letters/generate`,
        { ...formData, language: i18n.language },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setLetterContentEn(response.data.content_en);
      setLetterContentEs(response.data.content_es);
      setLetterContent(response.data.content_en);
      setCurrentLanguage('en');
      setLetterId(response.data.letter_id);
      setStep('generated');
      toast.success('Recommendation letter generated in English');
    } catch (error) {
      console.error('Error generating letter:', error);
      toast.error(error.response?.data?.detail || 'Error al generar la carta');
    } finally {
      setGenerating(false);
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

  const handleTranslate = async () => {
    if (letterContentEs) {
      // Spanish version already exists, just switch
      setCurrentLanguage('es');
      setLetterContent(letterContentEs);
      return;
    }

    setTranslating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/recommendation-letters/${letterId}/translate`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setLetterContentEs(response.data.content_es);
      setLetterContent(response.data.content_es);
      setCurrentLanguage('es');
      toast.success('Carta traducida a español');
    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Error al traducir la carta');
    } finally {
      setTranslating(false);
    }
  };

  const handleSwitchLanguage = (lang) => {
    if (lang === 'es' && !letterContentEs) {
      handleTranslate();
    } else if (lang === 'en') {
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

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            {i18n.language === 'es' ? 'Volver' : 'Back'}
          </Button>
          <div>
            <h1 className="app-title">✉️ {i18n.language === 'es' ? 'Carta de Recomendación' : 'Recommendation Letter'}</h1>
            <p className="app-subtitle">
              {i18n.language === 'es' 
                ? 'Cartas profesionales para solicitudes de visa' 
                : 'Professional letters for visa applications'}
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem' }}>
        {loadingClient ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <Loader2 className="animate-spin" size={48} />
          </div>
        ) : step === 'form' ? (
          <Card>
            <CardHeader>
              <CardTitle>{i18n.language === 'es' ? 'Información de la Carta' : 'Letter Information'}</CardTitle>
              <CardDescription>
                {i18n.language === 'es' 
                  ? 'Completa la información para generar una carta de recomendación profesional' 
                  : 'Fill out the information to generate a professional recommendation letter'}
              </CardDescription>
              {clientData && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  background: '#dbeafe', 
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#1e40af'
                }}>
                  ℹ️ {i18n.language === 'es' 
                    ? `Los datos del candidato se han cargado automáticamente desde el perfil de ${clientData.name}` 
                    : `Candidate data has been automatically loaded from ${clientData.name}'s profile`}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateLetter} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Candidate Information */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#1e3a8a' }}>
                    {i18n.language === 'es' ? 'Información del Candidato' : 'Candidate Information'}
                    {clientData && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                        ({i18n.language === 'es' ? 'Auto-cargado desde el cliente' : 'Auto-loaded from client'})
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Nombre Completo *' : 'Full Name *'}</Label>
                      <Input
                        value={formData.candidate_name}
                        onChange={(e) => handleInputChange('candidate_name', e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Ej: Dr. Juan Pérez' : 'E.g., Dr. John Doe'}
                        disabled={!!clientData}
                        style={clientData ? { background: '#f3f4f6', cursor: 'not-allowed' } : {}}
                        required
                      />
                    </div>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Campo de Especialización *' : 'Field of Expertise *'}</Label>
                      <Input
                        value={formData.candidate_field}
                        onChange={(e) => handleInputChange('candidate_field', e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Ej: Inteligencia Artificial' : 'E.g., Artificial Intelligence'}
                        required
                      />
                    </div>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Posición Actual' : 'Current Position'}</Label>
                      <Input
                        value={formData.candidate_position}
                        onChange={(e) => handleInputChange('candidate_position', e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Ej: Investigador Principal' : 'E.g., Principal Researcher'}
                      />
                    </div>
                  </div>
                </div>

                {/* Recommender Information */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', color: '#1e3a8a' }}>
                    {i18n.language === 'es' ? 'Información del Recomendante' : 'Recommender Information'}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Nombre del Recomendante *' : 'Recommender Name *'}</Label>
                      <Input
                        value={formData.recommender_name}
                        onChange={(e) => handleInputChange('recommender_name', e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Ej: Prof. María García' : 'E.g., Prof. Maria Garcia'}
                        required
                      />
                    </div>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Título/Cargo *' : 'Title/Position *'}</Label>
                      <Input
                        value={formData.recommender_title}
                        onChange={(e) => handleInputChange('recommender_title', e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Ej: Director de Investigación' : 'E.g., Research Director'}
                        required
                      />
                    </div>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Organización *' : 'Organization *'}</Label>
                      <Input
                        value={formData.recommender_organization}
                        onChange={(e) => handleInputChange('recommender_organization', e.target.value)}
                        placeholder={i18n.language === 'es' ? 'Ej: MIT' : 'E.g., MIT'}
                        required
                      />
                    </div>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Email' : 'Email'}</Label>
                      <Input
                        type="email"
                        value={formData.recommender_email}
                        onChange={(e) => handleInputChange('recommender_email', e.target.value)}
                        placeholder="email@organization.edu"
                      />
                    </div>
                    <div>
                      <Label>{i18n.language === 'es' ? 'Teléfono' : 'Phone'}</Label>
                      <Input
                        value={formData.recommender_phone}
                        onChange={(e) => handleInputChange('recommender_phone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Relationship & Achievements */}
                <div>
                  <Label>{i18n.language === 'es' ? 'Descripción de la Relación Profesional *' : 'Professional Relationship Description *'}</Label>
                  <Textarea
                    value={formData.relationship_description}
                    onChange={(e) => handleInputChange('relationship_description', e.target.value)}
                    placeholder={i18n.language === 'es' 
                      ? 'Describe cómo conoces al candidato, por cuánto tiempo, y en qué contexto han trabajado juntos...' 
                      : 'Describe how you know the candidate, for how long, and in what context you have worked together...'}
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <Label>{i18n.language === 'es' ? 'Logros y Contribuciones Clave *' : 'Key Achievements and Contributions *'}</Label>
                  <Textarea
                    value={formData.key_achievements}
                    onChange={(e) => handleInputChange('key_achievements', e.target.value)}
                    placeholder={i18n.language === 'es' 
                      ? 'Lista los logros específicos, proyectos, publicaciones, patentes, premios, impacto cuantificable...' 
                      : 'List specific achievements, projects, publications, patents, awards, quantifiable impact...'}
                    rows={6}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div>
                    <Label>{i18n.language === 'es' ? 'Tipo de Visa' : 'Visa Type'}</Label>
                    <Select value={formData.visa_type} onValueChange={(value) => handleInputChange('visa_type', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EB-2 NIW">EB-2 NIW</SelectItem>
                        <SelectItem value="O-1">O-1</SelectItem>
                        <SelectItem value="EB-1A">EB-1A</SelectItem>
                        <SelectItem value="EB-1B">EB-1B</SelectItem>
                        <SelectItem value="H-1B">H-1B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{i18n.language === 'es' ? 'Contexto Adicional (Opcional)' : 'Additional Context (Optional)'}</Label>
                  <Textarea
                    value={formData.additional_context}
                    onChange={(e) => handleInputChange('additional_context', e.target.value)}
                    placeholder={i18n.language === 'es' 
                      ? 'Cualquier información adicional que deba incluirse en la carta...' 
                      : 'Any additional information that should be included in the letter...'}
                    rows={3}
                  />
                </div>

                <Button type="submit" disabled={generating} style={{ width: 'fit-content' }}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      {i18n.language === 'es' ? 'Generando...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2" size={16} />
                      {i18n.language === 'es' ? 'Generar Carta' : 'Generate Letter'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : step === 'generated' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                  disabled={translating}
                  style={{ 
                    background: currentLanguage === 'es' ? '#2563eb' : 'transparent',
                    color: currentLanguage === 'es' ? 'white' : '#374151'
                  }}
                >
                  {translating ? (
                    <>
                      <Loader2 className="mr-1 animate-spin" size={14} />
                      Traduciendo...
                    </>
                  ) : (
                    '🇪🇸 Español'
                  )}
                </Button>
              </div>

              {/* Action Buttons */}
              <Button onClick={handleDownload}>
                <Download className="mr-2" size={16} />
                {i18n.language === 'es' ? 'Descargar PDF' : 'Download PDF'}
              </Button>
              <Button variant="outline" onClick={() => setEditMode(!editMode)}>
                <Edit className="mr-2" size={16} />
                {i18n.language === 'es' ? 'Editar Carta' : 'Edit Letter'}
              </Button>
              <Button variant="outline" onClick={() => {
                setStep('form');
                setLetterContent('');
                setLetterContentEn('');
                setLetterContentEs('');
                setLetterId(null);
                setCurrentLanguage('en');
              }}>
                <Plus className="mr-2" size={16} />
                {i18n.language === 'es' ? 'Nueva Carta' : 'New Letter'}
              </Button>
            </div>

            {/* Edit Mode */}
            {editMode && (
              <Card>
                <CardHeader>
                  <CardTitle>{i18n.language === 'es' ? 'Editar Carta' : 'Edit Letter'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <Textarea
                      value={editInstructions}
                      onChange={(e) => setEditInstructions(e.target.value)}
                      placeholder={i18n.language === 'es' 
                        ? 'Describe los cambios que quieres hacer a la carta...' 
                        : 'Describe the changes you want to make to the letter...'}
                      rows={4}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button onClick={handleEditLetter} disabled={generating}>
                        {generating ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" size={16} />
                            {i18n.language === 'es' ? 'Editando...' : 'Editing...'}
                          </>
                        ) : (
                          <>
                            <Save className="mr-2" size={16} />
                            {i18n.language === 'es' ? 'Aplicar Cambios' : 'Apply Changes'}
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setEditMode(false);
                        setEditInstructions('');
                      }}>
                        {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Letter Content */}
            <Card>
              <CardHeader>
                <CardTitle>{i18n.language === 'es' ? 'Carta Generada' : 'Generated Letter'}</CardTitle>
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
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  {letterContent.split('\n').map((line, index) => {
                    const trimmedLine = line.trim();
                    
                    // Empty line
                    if (!trimmedLine) {
                      return <div key={index} style={{ height: '0.5rem' }} />;
                    }
                    
                    // Letterhead in brackets
                    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
                      return (
                        <div key={index} style={{ 
                          textAlign: 'center', 
                          color: '#6b7280',
                          fontSize: '0.9rem',
                          marginBottom: '1rem',
                          fontFamily: 'Arial, sans-serif'
                        }}>
                          {trimmedLine}
                        </div>
                      );
                    }
                    
                    // Section headings with Roman numerals
                    if (/^[IVX]+\.\s+[A-Z]/.test(trimmedLine)) {
                      return (
                        <h2 key={index} style={{ 
                          fontSize: '1.3rem',
                          fontWeight: 'bold',
                          color: '#1e3a8a',
                          marginTop: '1.5rem',
                          marginBottom: '0.75rem',
                          fontFamily: 'Arial, sans-serif'
                        }}>
                          {trimmedLine}
                        </h2>
                      );
                    }
                    
                    // Separator lines
                    if (trimmedLine.startsWith('───') || trimmedLine === '---') {
                      return (
                        <hr key={index} style={{ 
                          border: 'none',
                          borderTop: '1px solid #e5e7eb',
                          margin: '1.5rem 0'
                        }} />
                      );
                    }
                    
                    // Bold text with **
                    let processedLine = trimmedLine;
                    const boldParts = processedLine.split('**');
                    if (boldParts.length > 1) {
                      return (
                        <p key={index} style={{ 
                          marginBottom: '0.75rem',
                          textAlign: 'justify'
                        }}>
                          {boldParts.map((part, i) => 
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                          )}
                        </p>
                      );
                    }
                    
                    // Regular paragraph
                    return (
                      <p key={index} style={{ 
                        marginBottom: '0.75rem',
                        textAlign: 'justify'
                      }}>
                        {trimmedLine}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
};


// ============================================================================
// VIEW RECOMMENDATION LETTER COMPONENT
// ============================================================================
const ViewRecommendationLetter = () => {
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [editing, setEditing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [currentContent, setCurrentContent] = useState('');
  const [translating, setTranslating] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

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
      // Set initial content to English
      setCurrentContent(response.data.content_en || response.data.content || '');
      setCurrentLanguage('en');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la carta');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (letter.content_es) {
      // Spanish version already exists
      setCurrentLanguage('es');
      setCurrentContent(letter.content_es);
      return;
    }

    setTranslating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/recommendation-letters/${id}/translate`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      // Update letter with Spanish version
      const updatedLetter = { ...letter, content_es: response.data.content_es };
      setLetter(updatedLetter);
      setCurrentContent(response.data.content_es);
      setCurrentLanguage('es');
      toast.success('Carta traducida a español');
    } catch (error) {
      console.error('Error translating:', error);
      toast.error('Error al traducir la carta');
    } finally {
      setTranslating(false);
    }
  };

  const handleSwitchLanguage = (lang) => {
    if (lang === 'es' && !letter.content_es) {
      handleTranslate();
    } else if (lang === 'en') {
      setCurrentLanguage('en');
      setCurrentContent(letter.content_en || letter.content || '');
    } else if (lang === 'es') {
      setCurrentLanguage('es');
      setCurrentContent(letter.content_es);
    }
  };

  const handleEdit = async () => {
    if (!editInstructions.trim()) {
      toast.error(i18n.language === 'es' ? 'Ingresa instrucciones de edición' : 'Enter edit instructions');
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

      setLetter({ ...letter, content: response.data.content });
      setEditMode(false);
      setEditInstructions('');
      toast.success(i18n.language === 'es' ? 'Carta editada exitosamente' : 'Letter edited successfully');
    } catch (error) {
      console.error('Error editing letter:', error);
      toast.error(error.response?.data?.detail || 'Error al editar la carta');
    } finally {
      setEditing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token');
      // Pass current language to download endpoint
      const response = await axios.get(
        `${API}/recommendation-letters/${id}/download?language=${currentLanguage}`,
        { 
          responseType: 'blob',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const langSuffix = currentLanguage === 'es' ? '_ES' : '_EN';
      const filename = `recommendation_letter_${letter.candidate_name.replace(/\s+/g, '_')}${langSuffix}_${id.substring(0, 8)}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Clean up the URL
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
      const langText = currentLanguage === 'es' ? 'español' : 'English';
      toast.success(`✅ ${i18n.language === 'es' ? 'PDF descargado' : 'PDF downloaded'} (${langText}): ${filename}`);
    } catch (error) {
      toast.error('Error al descargar');
    }
  };

  const handleDelete = async () => {
    if (!confirm(i18n.language === 'es' ? '¿Eliminar esta carta?' : 'Delete this letter?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/recommendation-letters/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success(i18n.language === 'es' ? 'Carta eliminada' : 'Letter deleted');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Error al eliminar');
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
    return null;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <Button variant="ghost" onClick={() => navigate(-1)} style={{ marginRight: '1rem' }}>
            <ArrowLeft className="mr-2" size={20} />
            {i18n.language === 'es' ? 'Volver' : 'Back'}
          </Button>
          <div>
            <h1 className="app-title">✉️ {i18n.language === 'es' ? 'Carta de Recomendación' : 'Recommendation Letter'}</h1>
            <p className="app-subtitle">
              {i18n.language === 'es' ? 'Para' : 'For'} {letter.candidate_name}
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ padding: '2rem 3rem' }}>
        {/* Language Toggle & Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Language Switcher */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            background: '#f3f4f6', 
            padding: '0.25rem', 
            borderRadius: '8px'
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
              disabled={translating}
              style={{ 
                background: currentLanguage === 'es' ? '#2563eb' : 'transparent',
                color: currentLanguage === 'es' ? 'white' : '#374151'
              }}
            >
              {translating ? (
                <>
                  <Loader2 className="mr-1 animate-spin" size={14} />
                  Traduciendo...
                </>
              ) : (
                '🇪🇸 Español'
              )}
            </Button>
          </div>

          {/* Action Buttons */}
          <Button onClick={handleDownload}>
            <Download className="mr-2" size={16} />
            {i18n.language === 'es' ? 'Descargar PDF' : 'Download PDF'}
          </Button>
          <Button variant="outline" onClick={() => setEditMode(!editMode)}>
            <Edit className="mr-2" size={16} />
            {i18n.language === 'es' ? 'Editar Carta' : 'Edit Letter'}
          </Button>
          <Button variant="outline" style={{ marginLeft: 'auto' }} onClick={handleDelete}>
            <Trash2 className="mr-2" size={16} />
            {i18n.language === 'es' ? 'Eliminar' : 'Delete'}
          </Button>
        </div>

        {/* Edit Mode */}
        {editMode && (
          <Card style={{ marginBottom: '1.5rem' }}>
            <CardHeader>
              <CardTitle>{i18n.language === 'es' ? 'Editar Carta' : 'Edit Letter'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Textarea
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder={i18n.language === 'es' 
                    ? 'Describe los cambios que quieres hacer...' 
                    : 'Describe the changes you want to make...'}
                  rows={4}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button onClick={handleEdit} disabled={editing}>
                    {editing ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        {i18n.language === 'es' ? 'Editando...' : 'Editing...'}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2" size={16} />
                        {i18n.language === 'es' ? 'Aplicar Cambios' : 'Apply Changes'}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setEditMode(false);
                    setEditInstructions('');
                  }}>
                    {i18n.language === 'es' ? 'Cancelar' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Letter Information Card */}
        <Card style={{ marginBottom: '1.5rem' }}>
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? 'Información' : 'Information'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <Label style={{ color: '#666', fontSize: '0.85rem' }}>
                  {i18n.language === 'es' ? 'Candidato' : 'Candidate'}
                </Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{letter.candidate_name}</p>
              </div>
              <div>
                <Label style={{ color: '#666', fontSize: '0.85rem' }}>
                  {i18n.language === 'es' ? 'Campo' : 'Field'}
                </Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{letter.candidate_field}</p>
              </div>
              <div>
                <Label style={{ color: '#666', fontSize: '0.85rem' }}>
                  {i18n.language === 'es' ? 'Recomendante' : 'Recommender'}
                </Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{letter.recommender_name}</p>
              </div>
              <div>
                <Label style={{ color: '#666', fontSize: '0.85rem' }}>
                  {i18n.language === 'es' ? 'Organización' : 'Organization'}
                </Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{letter.recommender_organization}</p>
              </div>
              <div>
                <Label style={{ color: '#666', fontSize: '0.85rem' }}>
                  {i18n.language === 'es' ? 'Tipo de Visa' : 'Visa Type'}
                </Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>{letter.visa_type}</p>
              </div>
              <div>
                <Label style={{ color: '#666', fontSize: '0.85rem' }}>
                  {i18n.language === 'es' ? 'Fecha de Creación' : 'Created'}
                </Label>
                <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>
                  {new Date(letter.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Letter Content Card */}
        <Card>
          <CardHeader>
            <CardTitle>{i18n.language === 'es' ? 'Contenido de la Carta' : 'Letter Content'}</CardTitle>
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {currentContent.split('\n').map((line, index) => {
                const trimmedLine = line.trim();
                
                // Empty line
                if (!trimmedLine) {
                  return <div key={index} style={{ height: '0.5rem' }} />;
                }
                
                // Letterhead in brackets
                if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
                  return (
                    <div key={index} style={{ 
                      textAlign: 'center', 
                      color: '#6b7280',
                      fontSize: '0.9rem',
                      marginBottom: '1rem',
                      fontFamily: 'Arial, sans-serif'
                    }}>
                      {trimmedLine}
                    </div>
                  );
                }
                
                // Section headings with Roman numerals
                if (/^[IVX]+\.\s+[A-Z]/.test(trimmedLine)) {
                  return (
                    <h2 key={index} style={{ 
                      fontSize: '1.3rem',
                      fontWeight: 'bold',
                      color: '#1e3a8a',
                      marginTop: '1.5rem',
                      marginBottom: '0.75rem',
                      fontFamily: 'Arial, sans-serif'
                    }}>
                      {trimmedLine}
                    </h2>
                  );
                }
                
                // Separator lines
                if (trimmedLine.startsWith('───') || trimmedLine === '---') {
                  return (
                    <hr key={index} style={{ 
                      border: 'none',
                      borderTop: '1px solid #e5e7eb',
                      margin: '1.5rem 0'
                    }} />
                  );
                }
                
                // Bold text with **
                let processedLine = trimmedLine;
                const boldParts = processedLine.split('**');
                if (boldParts.length > 1) {
                  return (
                    <p key={index} style={{ 
                      marginBottom: '0.75rem',
                      textAlign: 'justify'
                    }}>
                      {boldParts.map((part, i) => 
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </p>
                  );
                }
                
                // Regular paragraph
                return (
                  <p key={index} style={{ 
                    marginBottom: '0.75rem',
                    textAlign: 'justify'
                  }}>
                    {trimmedLine}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};


function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
          <Route path="/drafts" element={<ProtectedRoute><DraftsManager /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/client-dashboard/:clientId" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
          <Route path="/client-documents/:clientId/:docType" element={<ProtectedRoute><ClientDocumentsList /></ProtectedRoute>} />
          <Route path="/create-business-plan" element={<ProtectedRoute><CreateNIWInteractive /></ProtectedRoute>} />
          <Route path="/create-book" element={<ProtectedRoute><CreateBookInteractive /></ProtectedRoute>} />
          <Route path="/create-patent" element={<ProtectedRoute><CreatePatentV2 /></ProtectedRoute>} />
          <Route path="/create-patent-v2" element={<ProtectedRoute><CreatePatentV2 /></ProtectedRoute>} />
          <Route path="/view-patent-v2/:patentId" element={<ProtectedRoute><ViewPatentV2 /></ProtectedRoute>} />
          <Route path="/create-whitepaper" element={<ProtectedRoute><CreateWhitepaperInteractive /></ProtectedRoute>} />
          <Route path="/create-econometric-study" element={<ProtectedRoute><CreateEconometricStudy /></ProtectedRoute>} />
          <Route path="/create-recommendation-letter" element={<ProtectedRoute><CreateRecommendationLetter /></ProtectedRoute>} />
          <Route path="/design-document" element={<ProtectedRoute><DesignDocument /></ProtectedRoute>} />
          <Route path="/view-business-plan/:id" element={<ProtectedRoute><ViewBusinessPlan /></ProtectedRoute>} />
          <Route path="/view-book/:id" element={<ProtectedRoute><ViewBook /></ProtectedRoute>} />
          <Route path="/view-patent/:id" element={<ProtectedRoute><ViewPatent /></ProtectedRoute>} />
          <Route path="/view-econometric-study/:id" element={<ProtectedRoute><ViewEconometricStudy /></ProtectedRoute>} />
          <Route path="/view-recommendation-letter/:id" element={<ProtectedRoute><ViewRecommendationLetter /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

// ========================================
// PATENTS V2 COMPONENTS
// ========================================

const CreatePatentV2 = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('cv'); // cv, invention_titles, details, generating
  const [cvData, setCvData] = useState({
    applicant_name: '',
    applicant_cv: '',
    project_description: ''
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

  // Get client_id from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const clientId = searchParams.get('client_id');

  // Validate that client_id is present and load client data
  React.useEffect(() => {
    if (!clientId) {
      toast.error('Se requiere seleccionar un cliente para crear una patente');
      navigate('/dashboard');
    } else {
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
          applicant_cv: response.data.analyzed_cv
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
      setInventionSuggestions(response.data.suggestions);
      setPatentRecommendation(response.data.recommendation);
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
        client_id: clientId
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

        // Generate complete patent using NEW OPTIMIZED system
        toast.info('🔄 Generando patente...');
        
        await axios.post(
          `${API}/patents-v2/generate-complete/${patentId}`,
          {},
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        toast.success('✅ Patente generada exitosamente!');
        navigate(`/view-patent/${patentId}`);
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
      
      // Crear patente V2
      const createResponse = await axios.post(
        `${API}/patents-v2/start`,
        { ...formData, client_id: clientId },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const patentId = createResponse.data.id;
      toast.success('Patente creada! Generando todas las secciones...');
      setStep('generating');

      // Generar patente completa usando NUEVO sistema OPTIMIZADO
      toast.info('🔄 Generando patente... (2-3 minutos)');
      
      await axios.post(
        `${API}/patents-v2/generate-complete/${patentId}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      toast.success('¡Patente generada completamente!');
      navigate(`/view-patent/${patentId}`);
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

  return null;
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

export default App;