import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, Users, Mail, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AdvisorsList = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);

  const canManage = hasPermission('canManageStaff');

  useEffect(() => {
    const fetchAdvisors = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const { data } = await axios.get(`${API}/admin/advisors`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAdvisors(data.advisors);
      } catch (error) {
        console.error('Failed to load advisors:', error);
        toast.error('Error al cargar asesores');
      } finally {
        setLoading(false);
      }
    };

    fetchAdvisors();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Asesores
          </h1>
          <p className="text-gray-600 mt-2">Gestionar perfiles de asesores</p>
        </div>
        {canManage && (
          <Button
            onClick={() => navigate('/admin/advisors/create')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Asesor
          </Button>
        )}
      </div>

      {advisors.length === 0 ? (
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 mb-4">No se encontraron asesores. Crea tu primer perfil de asesor.</p>
            {canManage && (
              <Button
                onClick={() => navigate('/admin/advisors/create')}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear Asesor
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {advisors.map((advisor) => (
            <Card key={advisor._id} className="bg-white border-2 border-gray-200 hover:border-yellow-500/50 transition-colors shadow-md">
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <div className="h-16 w-16 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-2xl flex-shrink-0">
                    {advisor.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{advisor.name}</h3>
                    <p className="text-sm text-gray-600">{advisor.title}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge
                        className={
                          advisor.availability === 'available'
                            ? 'bg-success/20 text-success border border-success/30'
                            : 'bg-gray-500/20 text-gray-600 border border-gray-500/30'
                        }
                      >
                        {advisor.availability === 'available' ? 'Disponible' : 'No disponible'}
                      </Badge>
                      <Badge className="bg-purple-500/20 text-purple-600 border border-purple-500/30">
                        {advisor.assignedUsers?.length || 0} clientes
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {advisor.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {advisor.phone}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2" />
                  {advisor.experience?.years || 0} años de experiencia
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {advisor.specialties?.slice(0, 3).map((specialty, idx) => (
                    <Badge key={idx} className="text-xs bg-gray-100 text-gray-700 border border-gray-300">
                      {specialty}
                    </Badge>
                  ))}
                </div>
                <Button
                  onClick={() => navigate(`/admin/advisors/${advisor._id}`)}
                  className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                >
                  Ver Detalles
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
