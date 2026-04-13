import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Award,
  Plus,
  Edit,
  Trash2,
  Star,
  Eye,
  EyeOff,
  Search,
  RefreshCw,
  MapPin,
  Briefcase,
  TrendingUp,
  Clock,
  Heart,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  ShieldCheck,
  RotateCw,
  Upload,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const emptyStory = {
  name: '',
  profession: '',
  country: '',
  visa: 'EB-2 NIW',
  gender: '',
  age: '',
  previousStatus: '',
  projectName: '',
  photo: '',
  videoUrl: '',
  videoThumbnail: '',
  approvalDate: '',
  processingTime: '',
  score: 50,
  quote: '',
  keyAdvice: ['', '', ''],
  featured: false,
  active: true
};

export const SuccessStoriesAdmin = () => {
  const { admin } = useAdminAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentStory, setCurrentStory] = useState(null);
  const [formData, setFormData] = useState(emptyStory);
  const [saving, setSaving] = useState(false);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '20');
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive !== null) params.append('active', filterActive);
      
      const response = await fetch(`${API_URL}/api/success-stories/admin/all?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al cargar historias');
      
      const data = await response.json();
      setStories(data.stories || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
    } catch (error) {
      console.error('Error fetching stories:', error);
      toast.error('Error al cargar los casos de exito');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterActive, page]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterActive]);

  const handleOpenCreate = () => {
    setCurrentStory(null);
    setFormData(emptyStory);
    setEditDialogOpen(true);
  };

  const handleOpenEdit = (story) => {
    setCurrentStory(story);
    setFormData({
      ...emptyStory,
      ...story,
      age: story.age || '',
      gender: story.gender || '',
      previousStatus: story.previousStatus || '',
      projectName: story.projectName || '',
      keyAdvice: story.keyAdvice?.length >= 3 ? story.keyAdvice : [...(story.keyAdvice || []), '', '', ''].slice(0, 3)
    });
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (story) => {
    setCurrentStory(story);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.profession || !formData.country) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('admin_token');
      
      const cleanedAdvice = formData.keyAdvice.filter(a => a.trim() !== '');
      
      const payload = {
        ...formData,
        keyAdvice: cleanedAdvice,
        score: parseInt(formData.score) || 50,
        age: formData.age ? parseInt(formData.age) : null,
      };
      
      const url = currentStory 
        ? `${API_URL}/api/success-stories/admin/${currentStory.id}`
        : `${API_URL}/api/success-stories/admin`;
      
      const method = currentStory ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al guardar');
      }
      
      toast.success(currentStory ? 'Historia actualizada' : 'Historia creada');
      setEditDialogOpen(false);
      fetchStories();
    } catch (error) {
      console.error('Error saving story:', error);
      toast.error(error.message || 'Error al guardar la historia');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/success-stories/admin/${currentStory.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al eliminar');
      toast.success('Historia eliminada');
      setDeleteDialogOpen(false);
      setCurrentStory(null);
      fetchStories();
    } catch (error) {
      toast.error('Error al eliminar la historia');
    }
  };

  const toggleFeatured = async (story) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/success-stories/admin/${story.id}/toggle-featured`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error');
      const data = await response.json();
      toast.success(data.message);
      fetchStories();
    } catch (error) {
      toast.error('Error al cambiar estado destacado');
    }
  };

  const toggleActive = async (story) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/success-stories/admin/${story.id}/toggle-active`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error');
      const data = await response.json();
      toast.success(data.message);
      fetchStories();
    } catch (error) {
      toast.error('Error al cambiar estado activo');
    }
  };

  // ===== Generation & Migration =====
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [genApiKey, setGenApiKey] = useState('');
  const [genStatus, setGenStatus] = useState(null);
  const [polling, setPolling] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const handleGenerate = async () => {
    if (!genApiKey.trim()) { toast.error('Ingresa tu Gemini API Key'); return; }
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_URL}/api/success-stories/admin/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ gemini_api_key: genApiKey, count: 100 })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
      toast.success('Generacion iniciada en segundo plano');
      setPolling(true);
    } catch (err) { toast.error(err.message); }
  };

  const pollStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_URL}/api/success-stories/admin/generate/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setGenStatus(data);
      if (!data.running && data.completed) {
        setPolling(false);
        toast.success('Generacion completada');
        fetchStories();
      } else if (!data.running && !data.completed && data.message) {
        setPolling(false);
      }
    } catch (err) { /* ignore */ }
  }, [fetchStories]);

  useEffect(() => {
    if (!polling) return;
    const iv = setInterval(pollStatus, 3000);
    return () => clearInterval(iv);
  }, [polling, pollStatus]);

  const handleMigrate = async () => {
    try {
      setMigrating(true);
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_URL}/api/success-stories/admin/migrate-to-supabase`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      toast.success(data.message);
      fetchStories();
    } catch (err) { toast.error('Error al migrar'); }
    finally { setMigrating(false); }
  };

  const updateAdvice = (index, value) => {
    const newAdvice = [...formData.keyAdvice];
    newAdvice[index] = value;
    setFormData({ ...formData, keyAdvice: newAdvice });
  };

  const getPhotoUrl = (story) => {
    if (!story.photo) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.name}&backgroundColor=ffc700`;
    if (story.photo.startsWith('/api/')) return `${API_URL}${story.photo}`;
    return story.photo;
  };

  return (
    <div className="space-y-6" data-testid="success-stories-admin">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="h-7 w-7 text-yellow-500" />
            Casos de Exito
          </h1>
          <p className="text-gray-500 mt-1">
            Gestiona las historias de exito ({pagination.total} total)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleMigrate} disabled={migrating}
            className="border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="migrate-btn">
            {migrating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Migrar a Supabase
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setGenerateDialogOpen(true); pollStatus(); }}
            className="border-purple-300 text-purple-700 hover:bg-purple-50" data-testid="generate-btn">
            <RotateCw className="h-4 w-4 mr-1" />
            Regenerar 100
          </Button>
          <Button onClick={handleOpenCreate} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="create-story-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Generation progress banner */}
      {genStatus?.running && (
        <Card className="border-purple-300 bg-purple-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900">{genStatus.message}</p>
              <div className="w-full bg-purple-200 rounded-full h-2 mt-1.5">
                <div className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${genStatus.total ? (genStatus.progress / genStatus.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-purple-600 mt-1">{genStatus.progress}/{genStatus.total} - {genStatus.errors} errores</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, profesion o pais..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <div className="flex gap-2">
              <Button variant={filterActive === null ? "default" : "outline"} size="sm"
                onClick={() => setFilterActive(null)}
                className={filterActive === null ? "bg-yellow-500 hover:bg-yellow-400 text-black" : "border-gray-300 text-gray-700 hover:bg-gray-100"}
              >Todos</Button>
              <Button variant={filterActive === true ? "default" : "outline"} size="sm"
                onClick={() => setFilterActive(true)}
                className={filterActive === true ? "bg-green-500 hover:bg-green-400 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-100"}
              ><Eye className="h-4 w-4 mr-1" />Activos</Button>
              <Button variant={filterActive === false ? "default" : "outline"} size="sm"
                onClick={() => setFilterActive(false)}
                className={filterActive === false ? "bg-gray-500 hover:bg-gray-400 text-white" : "border-gray-300 text-gray-700 hover:bg-gray-100"}
              ><EyeOff className="h-4 w-4 mr-1" />Inactivos</Button>
              <Button variant="ghost" size="sm" onClick={fetchStories} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stories List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      ) : stories.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay casos de exito</h3>
            <p className="text-gray-500 mb-4">Crea el primer caso de exito para mostrarlo a los usuarios</p>
            <Button onClick={handleOpenCreate} className="bg-yellow-500 hover:bg-yellow-400 text-black">
              <Plus className="h-4 w-4 mr-2" />Crear Caso de Exito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {stories.map((story) => (
            <Card key={story.id} className={`transition-all ${!story.active ? 'opacity-60' : ''}`} data-testid={`admin-story-${story.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src={getPhotoUrl(story)}
                      alt={story.name}
                      className="h-14 w-14 rounded-full border-2 border-yellow-500 object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{story.name}</h3>
                      {story.gender && (
                        <Badge variant="outline" className="text-xs">{story.gender === 'M' ? 'Masculino' : 'Femenino'}</Badge>
                      )}
                      {story.age && (
                        <Badge variant="outline" className="text-xs">{story.age} anos</Badge>
                      )}
                      {story.featured && (
                        <Badge className="bg-yellow-500 text-black text-xs"><Star className="h-3 w-3 mr-1" />Destacado</Badge>
                      )}
                      {!story.active && (
                        <Badge variant="secondary" className="text-xs"><EyeOff className="h-3 w-3 mr-1" />Inactivo</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{story.profession}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{story.country}</span>
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-yellow-500" />{story.score}%</span>
                      {story.processingTime && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{story.processingTime}</span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Badge className="bg-green-100 text-green-800 border-green-200">{story.visa}</Badge>
                      {story.previousStatus && (
                        <Badge variant="outline" className="text-xs">
                          <ShieldCheck className="h-3 w-3 mr-1" />{story.previousStatus}
                        </Badge>
                      )}
                      {story.projectName && (
                        <Badge variant="outline" className="text-xs">
                          <FileText className="h-3 w-3 mr-1" />{story.projectName.substring(0, 40)}{story.projectName.length > 40 ? '...' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleFeatured(story)}
                      title={story.featured ? 'Quitar destacado' : 'Destacar'}>
                      <Star className={`h-4 w-4 ${story.featured ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(story)}
                      title={story.active ? 'Desactivar' : 'Activar'}>
                      {story.active ? <Eye className="h-4 w-4 text-green-500" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(story)} data-testid={`edit-story-${story.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(story)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">Pagina {page} de {pagination.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentStory ? 'Editar Caso de Exito' : 'Nuevo Caso de Exito'}</DialogTitle>
            <DialogDescription>
              {currentStory ? 'Modifica los detalles del caso de exito' : 'Completa los datos para crear un nuevo caso de exito'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Row 1: Name + Gender */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name" className="text-gray-900 font-semibold">Nombre completo *</Label>
                <Input id="name" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Carlos Mendez Rodriguez" className="border-gray-300" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-gray-900 font-semibold">Genero</Label>
                <select id="gender" value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900">
                  <option value="">Seleccionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
            </div>

            {/* Row 2: Profession + Age */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="profession" className="text-gray-900 font-semibold">Profesion *</Label>
                <Input id="profession" value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  placeholder="Ej: Ingeniero de Software" className="border-gray-300" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age" className="text-gray-900 font-semibold">Edad</Label>
                <Input id="age" type="number" min="18" max="99" value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="45" className="border-gray-300" autoComplete="off" />
              </div>
            </div>

            {/* Row 3: Country + Previous Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-gray-900 font-semibold">Pais de origen *</Label>
                <Input id="country" value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Ej: Colombia" className="border-gray-300" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="previousStatus" className="text-gray-900 font-semibold">Estatus migratorio previo</Label>
                <select id="previousStatus" value={formData.previousStatus}
                  onChange={(e) => setFormData({ ...formData, previousStatus: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900">
                  <option value="">Seleccionar</option>
                  <option value="Asylum Pending">Asylum Pending</option>
                  <option value="Visa TN">Visa TN</option>
                  <option value="Visa de Turista">Visa de Turista</option>
                  <option value="Visa H-1B">Visa H-1B</option>
                  <option value="Visa L-1">Visa L-1</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            {/* Row 4: Visa + Score */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visa" className="text-gray-900 font-semibold">Tipo de Visa aprobada</Label>
                <select id="visa" value={formData.visa}
                  onChange={(e) => setFormData({ ...formData, visa: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900">
                  <option value="EB-2 NIW">EB-2 NIW</option>
                  <option value="EB-1A">EB-1A</option>
                  <option value="O-1">O-1</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="score" className="text-gray-900 font-semibold">% de aprobacion al llegar a URPE</Label>
                <Input id="score" type="number" min="0" max="100" value={formData.score}
                  onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                  placeholder="50" className="border-gray-300" autoComplete="off" />
              </div>
            </div>

            {/* Row 5: Project Name + Processing Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectName" className="text-gray-900 font-semibold">Nombre del proyecto</Label>
                <Input id="projectName" value={formData.projectName}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="Ej: Plataforma de IA Medica" className="border-gray-300" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="processingTime" className="text-gray-900 font-semibold">Tiempo de aprobacion</Label>
                <Input id="processingTime" value={formData.processingTime}
                  onChange={(e) => setFormData({ ...formData, processingTime: e.target.value })}
                  placeholder="Ej: 6 meses" className="border-gray-300" autoComplete="off" />
              </div>
            </div>

            {/* Photo URL */}
            <div className="space-y-2">
              <Label htmlFor="photo" className="text-gray-900 font-semibold">URL de la foto</Label>
              <Input id="photo" value={formData.photo}
                onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                placeholder="URL de la foto o dejar vacio para avatar automatico" className="border-gray-300" autoComplete="off" />
              {formData.photo && (
                <img src={formData.photo.startsWith('/api/') ? `${API_URL}${formData.photo}` : formData.photo}
                  alt="Preview" className="h-16 w-16 rounded-full object-cover border-2 border-yellow-500 mt-1" />
              )}
            </div>

            {/* Quote */}
            <div className="space-y-2">
              <Label htmlFor="quote" className="text-gray-900 font-semibold">Testimonio / Cita</Label>
              <Textarea id="quote" value={formData.quote}
                onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                placeholder="Testimonio del cliente..." rows={3} className="border-gray-300" autoComplete="off" />
            </div>

            {/* Key Advice */}
            <div className="space-y-2">
              <Label className="text-gray-900 font-semibold">Consejos Clave (hasta 3)</Label>
              {[0, 1, 2].map((index) => (
                <Input key={index} value={formData.keyAdvice[index] || ''}
                  onChange={(e) => updateAdvice(index, e.target.value)}
                  placeholder={`Consejo ${index + 1}`} className="border-gray-300" autoComplete="off" />
              ))}
            </div>

            {/* Video */}
            <div className="space-y-2">
              <Label htmlFor="videoUrl" className="text-gray-900 font-semibold">URL del Video (opcional)</Label>
              <Input id="videoUrl" value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..." className="border-gray-300" autoComplete="off" />
            </div>

            {/* Status toggles */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <Switch id="featured" checked={formData.featured}
                  onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })} />
                <div>
                  <Label htmlFor="featured" className="cursor-pointer text-gray-900 font-semibold">Destacado</Label>
                  <p className="text-xs text-gray-500">Mostrar en seccion de recomendados</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="active" checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })} />
                <div>
                  <Label htmlFor="active" className="cursor-pointer text-gray-900 font-semibold">Activo</Label>
                  <p className="text-xs text-gray-500">Visible para los usuarios</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 hover:bg-yellow-400 text-black" data-testid="save-story-btn">
              {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>) : (currentStory ? 'Guardar Cambios' : 'Crear Historia')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-600" />
              Regenerar Casos de Exito
            </DialogTitle>
            <DialogDescription>
              Esto eliminara todos los casos actuales y generara 100 nuevos con imagenes AI unicas por profesion. Las imagenes se guardan en Supabase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-900 font-semibold">Gemini API Key *</Label>
              <Input value={genApiKey} onChange={(e) => setGenApiKey(e.target.value)}
                placeholder="AIzaSy..." className="border-gray-300 font-mono text-sm" type="password" autoComplete="off" />
              <p className="text-xs text-gray-500">Necesaria para generar imagenes con Imagen 4.0. El proceso tarda ~12 min por rate limits.</p>
            </div>
            {genStatus?.completed && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">{genStatus.message}</div>
            )}
            {genStatus?.running && (
              <div className="bg-purple-50 border border-purple-200 rounded p-3 text-sm text-purple-800">
                <Loader2 className="h-4 w-4 inline animate-spin mr-2" />
                {genStatus.message} ({genStatus.progress}/{genStatus.total})
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cerrar</Button>
            <Button onClick={handleGenerate} disabled={genStatus?.running}
              className="bg-purple-600 hover:bg-purple-500 text-white" data-testid="confirm-generate-btn">
              {genStatus?.running ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando...</>) : 'Iniciar Generacion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar caso de exito?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. Se eliminara permanentemente el caso de exito de <strong>{currentStory?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuccessStoriesAdmin;
