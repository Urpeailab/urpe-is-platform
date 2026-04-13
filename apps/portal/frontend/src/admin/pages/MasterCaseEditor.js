import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  ArrowLeft, Save, Plus, Edit, Trash2, Loader2, 
  Layers, FileText, Upload, AlertCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MasterCaseEditor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterCase, setMasterCase] = useState(null);
  const [stages, setStages] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    fetchMasterCase();
  }, []);

  const fetchMasterCase = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      const { data } = await axios.get(`${API}/admin/master-case`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMasterCase(data.masterCase);
      setStages(data.stages || []);
      setDeliverables(data.deliverables || []);
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching master case:', error);
      toast.error('Error al cargar el caso maestro');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMasterCase = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('admin_token');
      
      await axios.put(`${API}/admin/master-case`, {
        masterCase,
        stages,
        deliverables,
        documents
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Caso maestro guardado exitosamente');
      fetchMasterCase();
    } catch (error) {
      console.error('Error saving master case:', error);
      toast.error('Error al guardar el caso maestro');
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    const newStage = {
      stageNumber: stages.length + 1,
      name: { es: '', en: '' },
      description: { es: '', en: '' },
      amount: 0,
      isLocked: true,
      isPaid: false
    };
    setStages([...stages, newStage]);
  };

  const updateStage = (index, field, value) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const deleteStage = (index) => {
    if (!window.confirm('¿Eliminar esta etapa?')) return;
    const updated = stages.filter((_, i) => i !== index);
    // Renumber stages
    updated.forEach((stage, i) => {
      stage.stageNumber = i + 1;
    });
    setStages(updated);
  };

  const addDeliverable = () => {
    const newDeliverable = {
      name: { es: '', en: '' },
      description: { es: '', en: '' },
      stageNumber: 1,
      fileUrl: '',
      fileName: ''
    };
    setDeliverables([...deliverables, newDeliverable]);
  };

  const updateDeliverable = (index, field, value) => {
    const updated = [...deliverables];
    updated[index] = { ...updated[index], [field]: value };
    setDeliverables(updated);
  };

  const deleteDeliverable = (index) => {
    if (!window.confirm('¿Eliminar este entregable?')) return;
    setDeliverables(deliverables.filter((_, i) => i !== index));
  };

  const addDocument = () => {
    const newDoc = {
      name: { es: '', en: '' },
      description: { es: '', en: '' },
      stageNumber: 1,
      required: true
    };
    setDocuments([...documents, newDoc]);
  };

  const updateDocument = (index, field, value) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    setDocuments(updated);
  };

  const deleteDocument = (index) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    setDocuments(documents.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editor de Caso Maestro</h1>
            <p className="text-sm text-gray-500">
              Edita la plantilla base para todos los casos nuevos
            </p>
          </div>
        </div>
        <Button
          onClick={handleSaveMasterCase}
          disabled={saving}
          className="bg-success hover:bg-green-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>

      {/* Warning Banner */}
      <Card className="mb-6 border-yellow-300 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">⚠️ Importante:</p>
              <p>Los cambios en el caso maestro solo afectarán a los <strong>nuevos casos creados</strong>. Los casos existentes no se modificarán.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="stages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stages" className="gap-2">
            <Layers className="h-4 w-4" />
            Etapas ({stages.length})
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="gap-2">
            <FileText className="h-4 w-4" />
            Entregables ({deliverables.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <Upload className="h-4 w-4" />
            Documentos ({documents.length})
          </TabsTrigger>
        </TabsList>

        {/* Stages Tab */}
        <TabsContent value="stages" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Etapas del Proceso</h2>
            <Button onClick={addStage} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Etapa
            </Button>
          </div>

          {stages.map((stage, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Etapa {stage.stageNumber}
                  {stage.isPaid && <Badge className="ml-2 bg-success">Pagada</Badge>}
                  {stage.isLocked && <Badge className="ml-2 bg-red-500">Bloqueada</Badge>}
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteStage(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-900">Nombre (Español)</Label>
                    <Input
                      value={stage.name?.es || ''}
                      onChange={(e) => updateStage(index, 'name', { ...stage.name, es: e.target.value })}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">Nombre (English)</Label>
                    <Input
                      value={stage.name?.en || ''}
                      onChange={(e) => updateStage(index, 'name', { ...stage.name, en: e.target.value })}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-900">Descripción (Español)</Label>
                    <Textarea
                      value={stage.description?.es || ''}
                      onChange={(e) => updateStage(index, 'description', { ...stage.description, es: e.target.value })}
                      rows={3}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">Descripción (English)</Label>
                    <Textarea
                      value={stage.description?.en || ''}
                      onChange={(e) => updateStage(index, 'description', { ...stage.description, en: e.target.value })}
                      rows={3}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-900">Monto ($)</Label>
                    <Input
                      type="number"
                      value={stage.amount || 0}
                      onChange={(e) => updateStage(index, 'amount', parseFloat(e.target.value))}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={stage.isLocked || false}
                      onChange={(e) => updateStage(index, 'isLocked', e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label className="text-gray-900">Bloqueada</Label>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={stage.isPaid || false}
                      onChange={(e) => updateStage(index, 'isPaid', e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label className="text-gray-900">Pagada</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {stages.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No hay etapas. Click en "Agregar Etapa" para crear una.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Entregables</h2>
            <Button onClick={addDeliverable} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Entregable
            </Button>
          </div>

          {deliverables.map((deliverable, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Entregable #{index + 1}
                  <Badge className="ml-2">Etapa {deliverable.stageNumber}</Badge>
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteDeliverable(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-900">Etapa</Label>
                    <Input
                      type="number"
                      value={deliverable.stageNumber || 1}
                      onChange={(e) => updateDeliverable(index, 'stageNumber', parseInt(e.target.value))}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-gray-900">Nombre del Archivo</Label>
                    <Input
                      value={deliverable.fileName || ''}
                      onChange={(e) => updateDeliverable(index, 'fileName', e.target.value)}
                      placeholder="documento.pdf"
                      className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-900">Nombre (Español)</Label>
                    <Input
                      value={deliverable.name?.es || ''}
                      onChange={(e) => updateDeliverable(index, 'name', { ...deliverable.name, es: e.target.value })}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">Nombre (English)</Label>
                    <Input
                      value={deliverable.name?.en || ''}
                      onChange={(e) => updateDeliverable(index, 'name', { ...deliverable.name, en: e.target.value })}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {deliverables.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No hay entregables. Click en "Agregar Entregable" para crear uno.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Documentos Requeridos</h2>
            <Button onClick={addDocument} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Documento
            </Button>
          </div>

          {documents.map((doc, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Documento #{index + 1}
                  <Badge className="ml-2">Etapa {doc.stageNumber}</Badge>
                  {doc.required && <Badge className="ml-2 bg-red-500">Requerido</Badge>}
                </CardTitle>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteDocument(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-900">Etapa</Label>
                    <Input
                      type="number"
                      value={doc.stageNumber || 1}
                      onChange={(e) => updateDocument(index, 'stageNumber', parseInt(e.target.value))}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={doc.required || false}
                      onChange={(e) => updateDocument(index, 'required', e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label className="text-gray-900">Requerido</Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-900">Nombre (Español)</Label>
                    <Input
                      value={doc.name?.es || ''}
                      onChange={(e) => updateDocument(index, 'name', { ...doc.name, es: e.target.value })}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">Nombre (English)</Label>
                    <Input
                      value={doc.name?.en || ''}
                      onChange={(e) => updateDocument(index, 'name', { ...doc.name, en: e.target.value })}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-900">Descripción (Español)</Label>
                    <Textarea
                      value={doc.description?.es || ''}
                      onChange={(e) => updateDocument(index, 'description', { ...doc.description, es: e.target.value })}
                      rows={2}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">Descripción (English)</Label>
                    <Textarea
                      value={doc.description?.en || ''}
                      onChange={(e) => updateDocument(index, 'description', { ...doc.description, en: e.target.value })}
                      rows={2}
                      className="bg-white text-gray-900 border-gray-300"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {documents.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No hay documentos. Click en "Agregar Documento" para crear uno.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Save Button (Bottom) */}
      <div className="mt-6 flex justify-end">
        <Button
          onClick={handleSaveMasterCase}
          disabled={saving}
          size="lg"
          className="bg-success hover:bg-green-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Todos los Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
