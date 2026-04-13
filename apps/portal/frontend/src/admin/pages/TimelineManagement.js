import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { FileText, Users, Settings } from 'lucide-react';
import { TimelineTemplates } from './TimelineTemplates';
import { TimelineOverview } from './TimelineOverview';
import { FilingTimelineData } from './FilingTimelineData';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { toast } from 'sonner';

export const TimelineManagement = () => {
  const [activeTab, setActiveTab] = useState('templates');
  const navigate = useNavigate();
  const { admin, loading } = useAdminAuth();

  useEffect(() => {
    // Solo super_admin puede acceder
    if (!loading && admin && admin.role !== 'super_admin') {
      toast.error('Acceso denegado. Solo super administradores pueden acceder a esta sección.');
      navigate('/admin/dashboard');
    }
  }, [admin, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!admin || admin.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Gestión de Cronogramas
        </h1>
        <p className="text-gray-600 mt-2">Administra plantillas, clientes y configuración de servicios</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger 
            value="templates" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Plantillas
          </TabsTrigger>
          <TabsTrigger 
            value="clients" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger 
            value="services" 
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configuración de Servicios
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6">
          <TimelineTemplates />
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="mt-6">
          <TimelineOverview />
        </TabsContent>

        {/* Services Configuration Tab */}
        <TabsContent value="services" className="mt-6">
          <FilingTimelineData />
        </TabsContent>
      </Tabs>
    </div>
  );
};
