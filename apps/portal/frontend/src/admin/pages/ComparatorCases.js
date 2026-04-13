import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Plus, Globe, Briefcase, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ComparatorCaseFormModal } from '../components/ComparatorCaseFormModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const ComparatorCases = () => {
  const { hasPermission } = useAdminAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [ seleccionadoCase, setSelectedCase] = useState(null);

  const canManage = hasPermission('canManageContent');

  const fetchCases = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/admin/comparator-cases`, { 
        params: { limit: 100 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setCases(data.cases);
    } catch (error) {
      console.error('Failed to load cases:', error);
      toast.error('Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this case?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/admin/comparator-cases/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Case deleted');
      fetchCases();
    } catch (error) {
      toast.error('Failed to delete case');
    }
  };

  const handleCreate = () => {
    setSelectedCase(null);
    setShowModal(true);
  };

  const handleEdit = (case_) => {
    setSelectedCase(case_);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCase(null);
  };

  const handleSuccess = () => {
    fetchCases();
  };

  return (
    <div className="space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Comparator Cases
          </h1>
          <p className="text-gray-600 mt-2">Manage success stories and comparison cases</p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            <Plus className="mr-2 h-4 w-4" />
            Add Case
          </Button>
        )}
      </div>

      {cases.length === 0 ? (
        <Card className="bg-white border-2 border-gray-200 shadow-md">
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">No se encontraron casos. Add success stories for comparison.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((case_) => (
            <Card key={case_._id} className="bg-white border-2 border-gray-200 shadow-md">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center justify-between">
                  <span>{case_.country}</span>
                  <Badge className="bg-success/20 text-success">
                    {case_.outcome?.status || 'Unknown'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Briefcase className="h-4 w-4 mr-2" />
                  {case_.profession}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Globe className="h-4 w-4 mr-2" />
                  {case_.visaType}
                </div>
                <div className="text-sm text-gray-600">
                  Processing: {case_.outcome?.processingTime || 0} months
                </div>
                <div className="text-sm text-gray-600">
                  Success Rate: {case_.outcome?.successRate || 0}%
                </div>
                {canManage && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(case_)}
                      className="flex-1 bg-white hover:bg-gray-100 text-gray-900 border-gray-300"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(case_._id)}
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
        <ComparatorCaseFormModal
          case={ seleccionadoCase}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};