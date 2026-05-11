import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, Video, Calendar, Trash2, Users, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { WebinarFormModal } from '../components/WebinarFormModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Title/description columns are stored as JSONB but some rows or the supabase
// driver can return them as a JSON-encoded string. Accept both shapes.
const i18nText = (value, fallback = '') => {
  if (!value) return fallback;
  let v = value;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.startsWith('{')) {
      try { v = JSON.parse(trimmed); } catch { return v; }
    } else {
      return v;
    }
  }
  if (typeof v === 'object') {
    return v.es || v.en || fallback;
  }
  return String(v);
};

export const WebinarsList = () => {
  const navigate = useNavigate();
  const { hasPermission, admin } = useAdminAuth();
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [ seleccionadoWebinar, setSelectedWebinar] = useState(null);

  const canManage = hasPermission('canManageContent') || ['super_admin', 'admin'].includes(admin?.role);

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/webinars`, {
        params: { limit: 100, webinar_type: filter !== 'all' ? filter : undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      setWebinars(data.webinars);
    } catch (error) {
      console.error('Failed a load webinars:', error);
      toast.error('Failed a load webinars');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebinars();
  }, [filter]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete webinar: ${title}?`)) return;
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/webinars/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Webinar deleted');
      fetchWebinars();
    } catch (error) {
      toast.error('Failed a delete webinar');
    }
  };

  const handleCreate = () => {
    setSelectedWebinar(null);
    setShowModal(true);
  };

  const handleEdit = (webinar) => {
    setSelectedWebinar(webinar);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedWebinar(null);
  };

  const handleSuccess = () => {
    fetchWebinars();
  };

  const upcomingWebinars = webinars.filter(w => w.type === 'upcoming');
  const recordedWebinars = webinars.filter(w => w.type === 'recorded');

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Webinars & Events
          </h1>
          <p className="text-gray-600 mt-2">Manage webinars and recorded sessions</p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            <Plus className="mr-2 h-4 w-4" />
            Create Webinar
          </Button>
        )}
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-white border-2 border-gray-200">
          <TabsTrigger value="all" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-900">All ({webinars.length})</TabsTrigger>
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-900">Próximos ({upcomingWebinars.length})</TabsTrigger>
          <TabsTrigger value="recorded" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black text-gray-900">Recorded ({recordedWebinars.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {webinars.length === 0 ? (
            <Card className="bg-white border-2 border-gray-200 shadow-md">
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No se encontraron webinars</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {webinars.map((webinar) => (
                <Card key={webinar._id} className="bg-white border-2 border-gray-200 hover:border-yellow-500/50 transition-colors shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-gray-900 text-lg">
                          {i18nText(webinar.title, 'Untitled')}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {i18nText(webinar.description).substring(0, 80)}{i18nText(webinar.description).length > 80 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Badge className={webinar.type === 'upcoming' ? 'bg-success/20 text-success border border-success/30' : 'bg-blue-500/20 text-blue-600 border border-blue-500/30'}>
                        {webinar.type}
                      </Badge>
                      <Badge className="bg-purple-500/20 text-purple-600 border border-purple-500/30">
                        {webinar.level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {webinar.type === 'upcoming' && webinar.date && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(webinar.date).toLocaleDateString()}
                      </div>
                    )}
                    {webinar.type === 'upcoming' && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        {webinar.registeredCount || 0} / {webinar.capacity} registered
                      </div>
                    )}
                    {canManage && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(webinar)}
                          className="flex-1 bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(webinar._id, i18nText(webinar.title, 'webinar'))}
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showModal && (
        <WebinarFormModal
          webinar={ seleccionadoWebinar}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};