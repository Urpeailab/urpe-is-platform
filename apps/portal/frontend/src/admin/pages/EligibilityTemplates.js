import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, FileText, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const EligibilityTemplates = () => {
  const { hasPermission, admin, loading: authLoading } = useAdminAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const canManage = hasPermission('canManageContent');

  useEffect(() => {
    // Solo super_admin puede acceder
    if (!authLoading && admin && admin.role !== 'super_admin') {
      toast.error('Acceso denegado. Solo super administradores pueden acceder a esta sección.');
      navigate('/admin/dashboard');
      return;
    }
    if (!authLoading && admin) {
      fetchTemplates();
    }
  }, [admin, authLoading, navigate]);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/eligibility-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load eligibility templates');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!admin || admin.role !== 'super_admin') {
    return null;
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template: ${name}?`)) return;
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/eligibility-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Eligibility Templates
          </h1>
          <p className="text-gray-600 mt-2">Manage eligibility report templates</p>
        </div>
        {canManage && (
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-600" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No se encontraron plantillas</h3>
              <p className="mt-2 text-sm text-gray-600">
                Crea tu primer eligibility template a get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template._id} className="bg-white border-2 border-gray-200 shadow-md hover:border-gray-700 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-8 w-8 text-yellow-500" />
                  <Badge className="bg-blue-500/20 text-blue-500">
                    {template.visaType || 'General'}
                  </Badge>
                </div>
                <CardTitle className="text-gray-900 mt-4">{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">{template.description}</p>
                
                {canManage && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
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
    </div>
  );
};
