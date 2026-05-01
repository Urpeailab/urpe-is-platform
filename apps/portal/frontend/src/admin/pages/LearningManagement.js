import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, Edit, Trash2, FileText, GraduationCap, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_COLORS = {
  draft: 'bg-gray-200 text-gray-700',
  published: 'bg-green-200 text-green-800',
  archived: 'bg-yellow-200 text-yellow-800',
};

const MODE_LABEL = { free: 'Libre', guided: 'Guiado' };

export const LearningManagement = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  const canAudit = hasPermission('view_learning_sessions');

  const fetchModules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/learning/modules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setModules(data.modules || []);
    } catch (err) {
      toast.error('Error cargando módulos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`¿Eliminar el módulo "${title}"? Esto borrará también sus documentos y chunks.`)) return;
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/learning/modules/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Módulo eliminado');
      fetchModules();
    } catch (err) {
      toast.error('Error eliminando módulo');
    }
  };

  return (
    <div className="space-y-6 bg-white min-h-screen p-6 text-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Gestión de Aprendizaje
          </h1>
          <p className="text-gray-600 mt-2">
            Crea módulos, sube material y administra el avatar de aprendizaje para el equipo.
          </p>
        </div>
        <div className="flex gap-2">
          {canAudit && (
            <Button variant="outline" onClick={() => navigate('/admin/learning-admin/sessions')} className="text-gray-900 border-gray-300">
              <Eye className="mr-2 h-4 w-4" />
              Auditoría de sesiones
            </Button>
          )}
          <Button
            onClick={() => navigate('/admin/learning-admin/new')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo módulo
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : modules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <GraduationCap className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            Aún no hay módulos. Crea el primero para empezar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <Card key={m.id} className="border hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg text-gray-900">{m.title}</CardTitle>
                  <Badge className={STATUS_COLORS[m.status] || ''}>{m.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 line-clamp-3 min-h-[3rem] mb-3">
                  {m.description || <span className="italic text-gray-400">Sin descripción</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Badge variant="outline" className="text-gray-700">{MODE_LABEL[m.mode] || m.mode}</Badge>
                  <span>•</span>
                  <span>{m.llm_model || 'modelo default'}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/learning-admin/${m.id}`)}
                    className="text-gray-900 border-gray-300"
                  >
                    <Edit className="mr-1 h-3 w-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/learning-admin/${m.id}#documents`)}
                    className="text-gray-900 border-gray-300"
                  >
                    <FileText className="mr-1 h-3 w-3" /> Material
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 border-gray-300"
                    onClick={() => handleDelete(m.id, m.title)}
                  >
                    <Trash2 className="h-3 w-3" />
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

export default LearningManagement;
