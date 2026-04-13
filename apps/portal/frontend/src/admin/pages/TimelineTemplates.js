import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, Clock, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { TimelineTemplateFormModal } from '../components/TimelineTemplateFormModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TimelineTemplates = () => {
  const { hasPermission } = useAdminAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [ seleccionadoTemplate, setSelectedTemplate] = useState(null);

  const canManage = hasPermission('canManageContent');

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/timeline-templates`, { 
        params: { limit: 100 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Error al cargar plantillas de cronograma');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar plantilla: ${name}?`)) return;
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/timeline-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Plantilla eliminada');
      fetchTemplates();
    } catch (error) {
      toast.error('Error al eliminar plantilla');
    }
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTemplate(null);
  };

  const handleSuccess = () => {
    fetchTemplates();
  };

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Plantillas de Cronograma
          </h1>
          <p className="text-gray-600 mt-2">Manage process timeline templates</p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600">No timeline templates found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <Card key={template._id} className="bg-white border-2 border-gray-200 shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-gray-900">{template.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  </div>
                  {template.isDefault && (
                    <Badge className="bg-yellow-500/20 text-yellow-500">Default</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Process Type:</span>
                  <Badge className="bg-blue-500/20 text-blue-500">{template.processType}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Stages:</span>
                  <span className="text-gray-900">{template.stages?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Est. Duration:</span>
                  <span className="text-gray-900">{template.prediction?.estimatedTotalMonths || 0} months</span>
                </div>
                {canManage && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      className="flex-1 bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(template._id, template.name)}
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

      {showModal && (
        <TimelineTemplateFormModal
          template={ seleccionadoTemplate}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};