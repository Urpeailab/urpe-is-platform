import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Package, 
  ArrowRight, 
  Edit2, 
  Save, 
  X, 
  RefreshCw,
  AlertCircle,
  Users,
  ChevronDown,
  ChevronRight,
  MoveRight,
  Plus,
  Trash2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const DeliverableDocumentManagement = () => {
  const [deliverableStages, setDeliverableStages] = useState([]);
  const [documentStages, setDocumentStages] = useState([]);
  const [masterStages, setMasterStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Move modal state
  const [moveModal, setMoveModal] = useState({ open: false, type: null, item: null, fromStage: null });
  const [targetStage, setTargetStage] = useState('');
  
  // Rename modal state
  const [renameModal, setRenameModal] = useState({ open: false, type: null, item: null, stageNumber: null });
  const [newName, setNewName] = useState({ es: '', en: '' });
  
  // Create modal state
  const [createModal, setCreateModal] = useState({ open: false, type: null, stageNumber: null });
  const [newItemForm, setNewItemForm] = useState({ name_es: '', name_en: '' });
  const [applyTo, setApplyTo] = useState('new_only');
  const [allCasesWithStage, setAllCasesWithStage] = useState([]);
  const [selectedCases, setSelectedCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  
  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, item: null, stageNumber: null });
  const [deleteFromCases, setDeleteFromCases] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [delRes, docRes, stagesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/deliverable-templates`, { headers }),
        fetch(`${API_URL}/api/admin/document-templates`, { headers }),
        fetch(`${API_URL}/api/admin/stage-templates`, { headers })
      ]);

      if (delRes.ok) {
        const delData = await delRes.json();
        setDeliverableStages(delData.stages || []);
      }

      if (docRes.ok) {
        const docData = await docRes.json();
        setDocumentStages(docData.stages || []);
      }

      if (stagesRes.ok) {
        const stagesData = await stagesRes.json();
        setMasterStages(stagesData.stages || []);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMove = async () => {
    if (!targetStage || !moveModal.item) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = moveModal.type === 'deliverable' 
        ? '/api/admin/deliverable-templates/move'
        : '/api/admin/document-templates/move';
      
      const body = moveModal.type === 'deliverable'
        ? {
            deliverable_name_es: moveModal.item.deliverableName || moveModal.item.name?.es,
            from_stage: moveModal.fromStage,
            to_stage: parseInt(targetStage)
          }
        : {
            document_name_es: moveModal.item.documentName || moveModal.item.name?.es,
            from_stage: moveModal.fromStage,
            to_stage: parseInt(targetStage)
          };
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail || 'Error al mover');
      }
      
      toast.success(result.message, {
        description: `${result.casesUpdated} casos actualizados`
      });
      
      setMoveModal({ open: false, type: null, item: null, fromStage: null });
      setTargetStage('');
      fetchData();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!newName.es || !renameModal.item) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = renameModal.type === 'deliverable'
        ? '/api/admin/deliverable-templates/rename'
        : '/api/admin/document-templates/rename';
      
      const body = renameModal.type === 'deliverable'
        ? {
            old_name_es: renameModal.item.deliverableName || renameModal.item.name?.es,
            new_name_es: newName.es,
            new_name_en: newName.en || newName.es,
            stage_number: renameModal.stageNumber
          }
        : {
            old_name_es: renameModal.item.documentName || renameModal.item.name?.es,
            new_name_es: newName.es,
            new_name_en: newName.en || newName.es,
            stage_number: renameModal.stageNumber
          };
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.detail || 'Error al renombrar');
      }
      
      toast.success(result.message, {
        description: `${result.casesUpdated} casos actualizados`
      });
      
      setRenameModal({ open: false, type: null, item: null, stageNumber: null });
      setNewName({ es: '', en: '' });
      fetchData();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchCasesWithStage = async (stageNumber) => {
    setLoadingCases(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/admin/cases?stage_number=${stageNumber}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error fetching cases');
      
      const data = await response.json();
      setAllCasesWithStage(data.cases || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los casos');
    } finally {
      setLoadingCases(false);
    }
  };

  const handleCreate = async () => {
    if (!newItemForm.name_es.trim()) {
      toast.error('El nombre en español es requerido');
      return;
    }

    if (applyTo === 'selected_cases' && selectedCases.length === 0) {
      toast.error('Debes seleccionar al menos un caso');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = createModal.type === 'deliverable'
        ? '/api/admin/deliverable-templates'
        : '/api/admin/document-templates';
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stage_number: createModal.stageNumber,
          name_es: newItemForm.name_es,
          name_en: newItemForm.name_en || newItemForm.name_es,
          apply_to: applyTo,
          case_ids: applyTo === 'selected_cases' ? selectedCases : []
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al crear');
      }

      const result = await response.json();

      let description = `${result.name.es}`;
      if (result.cases_affected > 0) {
        description += ` - Aplicado a ${result.cases_affected} caso${result.cases_affected !== 1 ? 's' : ''}`;
      }

      toast.success(`${createModal.type === 'deliverable' ? 'Entregable' : 'Documento'} creado`, { description });

      setCreateModal({ open: false, type: null, stageNumber: null });
      setNewItemForm({ name_es: '', name_en: '' });
      setApplyTo('new_only');
      setSelectedCases([]);
      fetchData();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (item, type, stageNumber) => {
    setDeleteModal({ open: true, type, item, stageNumber });
    setDeleteFromCases(true);
  };

  const handleConfirmDelete = async () => {
    const { item, type, stageNumber } = deleteModal;
    if (!item) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = type === 'deliverable'
        ? '/api/admin/deliverable-templates'
        : '/api/admin/document-templates';
      
      const name_es = item.name?.es || item.deliverableName || item.documentName;
      
      const response = await fetch(`${API_URL}${endpoint}?stage_number=${stageNumber}&name_es=${encodeURIComponent(name_es)}&delete_from_cases=${deleteFromCases}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al eliminar');
      }

      const result = await response.json();

      let description = result.message;
      if (result.cases_affected > 0) {
        description += ` - ${result.cases_affected} caso${result.cases_affected !== 1 ? 's afectados' : ' afectado'}`;
      }

      toast.success(`${type === 'deliverable' ? 'Entregable' : 'Documento'} eliminado`, { description });

      setDeleteModal({ open: false, type: null, item: null, stageNumber: null });
      setDeleteFromCases(true);
      fetchData();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  // Source of truth: master stage list from /admin/stage-templates.
  // Fall back to the union of stages observed in deliverables/documents
  // if the master list hasn't loaded yet (no hardcoded 1..11).
  const allStageNumbers = (masterStages.length > 0
    ? masterStages.map(s => s.stageNumber)
    : [...new Set([
        ...deliverableStages.map(s => s.stageNumber),
        ...documentStages.map(s => s.stageNumber),
      ])]
  ).sort((a, b) => a - b);

  const renderItemList = (items, type, stageNumber) => (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const name = type === 'deliverable' 
          ? (item.deliverableName || item.name?.es || 'Sin nombre')
          : (item.documentName || item.name?.es || 'Sin nombre');
        
        return (
          <div 
            key={idx}
            className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {type === 'deliverable' ? (
                <Package className="h-4 w-4 text-blue-500 flex-shrink-0" />
              ) : (
                <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{name}</p>
                {item.name?.en && item.name.en !== item.name?.es && (
                  <p className="text-xs text-gray-500">EN: {item.name.en}</p>
                )}
              </div>
              <Badge className="bg-gray-100 text-gray-600 flex-shrink-0">
                {item.count} casos
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRenameModal({ open: true, type, item, stageNumber });
                  setNewName({ 
                    es: item.deliverableName || item.documentName || item.name?.es || '', 
                    en: item.name?.en || '' 
                  });
                }}
                className="text-gray-600 hover:text-blue-600"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMoveModal({ open: true, type, item, fromStage: stageNumber })}
                className="text-gray-600 hover:text-green-600"
              >
                <MoveRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteClick(item, type, stageNumber)}
                className="text-gray-600 hover:text-red-600 border-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="deliverable-document-management">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-7 w-7 text-blue-500" />
            Gestión de Entregables y Documentos
          </h1>
          <p className="text-gray-500 mt-1">Mueve o renombra entregables y documentos entre etapas</p>
        </div>
        <Button 
          onClick={fetchData} 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-800 font-medium">Cambios masivos</p>
          <p className="text-sm text-amber-600">
            Los cambios afectarán a <strong>todos los casos</strong> existentes. Esta acción no se puede deshacer.
          </p>
        </div>
      </div>

      {/* Quick Add Section */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Agregar a Cualquier Etapa</h3>
            <p className="text-sm text-gray-600">
              Selecciona una etapa para agregar nuevos entregables o documentos
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">Etapa:</Label>
              <Select value={createModal.stageNumber?.toString() || ''} onValueChange={(val) => setCreateModal({ ...createModal, stageNumber: parseInt(val) })}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={allStageNumbers.length === 0 ? 'Sin etapas' : 'Elegir'} />
                </SelectTrigger>
                <SelectContent>
                  {allStageNumbers.map(num => (
                    <SelectItem key={num} value={num.toString()}>Etapa {num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!createModal.stageNumber) {
                    toast.error('Selecciona una etapa primero');
                    return;
                  }
                  setCreateModal({ open: true, type: 'deliverable', stageNumber: createModal.stageNumber });
                }}
                disabled={!createModal.stageNumber}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Entregable
              </Button>
              <Button
                onClick={() => {
                  if (!createModal.stageNumber) {
                    toast.error('Selecciona una etapa primero');
                    return;
                  }
                  setCreateModal({ open: true, type: 'document', stageNumber: createModal.stageNumber });
                }}
                disabled={!createModal.stageNumber}
                className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 mr-2" />
                Documento
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="deliverables" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="deliverables" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Entregables
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documentos del Cliente
          </TabsTrigger>
        </TabsList>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : deliverableStages.length === 0 ? (
              <div className="text-center p-12">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay entregables configurados</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {deliverableStages.map((stage) => (
                  <AccordionItem key={stage.stageNumber} value={`stage-${stage.stageNumber}`}>
                    <AccordionTrigger className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                          {stage.stageNumber}
                        </div>
                        <span className="font-semibold text-gray-900">
                          Etapa {stage.stageNumber}
                        </span>
                        <Badge className="bg-blue-100 text-blue-700">
                          {stage.deliverables?.length || 0} entregables
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-3">
                        {stage.deliverables?.length > 0 && renderItemList(stage.deliverables, 'deliverable', stage.stageNumber)}
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            setCreateModal({ open: true, type: 'deliverable', stageNumber: stage.stageNumber });
                            if (applyTo !== 'new_only') {
                              fetchCasesWithStage(stage.stageNumber);
                            }
                          }}
                          className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Entregable a Etapa {stage.stageNumber}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              </div>
            ) : documentStages.length === 0 ? (
              <div className="text-center p-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No hay documentos configurados</p>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {documentStages.map((stage) => (
                  <AccordionItem key={stage.stageNumber} value={`doc-stage-${stage.stageNumber}`}>
                    <AccordionTrigger className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                          {stage.stageNumber}
                        </div>
                        <span className="font-semibold text-gray-900">
                          Etapa {stage.stageNumber}
                        </span>
                        <Badge className="bg-green-100 text-green-700">
                          {stage.documents?.length || 0} documentos
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-3">
                        {stage.documents?.length > 0 && renderItemList(stage.documents, 'document', stage.stageNumber)}
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            setCreateModal({ open: true, type: 'document', stageNumber: stage.stageNumber });
                            if (applyTo !== 'new_only') {
                              fetchCasesWithStage(stage.stageNumber);
                            }
                          }}
                          className="w-full bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Documento a Etapa {stage.stageNumber}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Move Modal */}
      <Dialog open={moveModal.open} onOpenChange={(open) => setMoveModal({ ...moveModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover {moveModal.type === 'deliverable' ? 'Entregable' : 'Documento'}</DialogTitle>
            <DialogDescription>
              Selecciona la etapa destino para mover "{moveModal.item?.deliverableName || moveModal.item?.documentName || moveModal.item?.name?.es}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                <span className="font-medium">Etapa {moveModal.fromStage}</span>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <Select value={targetStage} onValueChange={setTargetStage}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Destino" />
                </SelectTrigger>
                <SelectContent>
                  {allStageNumbers
                    .filter(n => n !== moveModal.fromStage)
                    .map(num => (
                      <SelectItem key={num} value={String(num)}>
                        Etapa {num}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-sm text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Este cambio afectará a <strong>{moveModal.item?.count || 0}</strong> casos existentes.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveModal({ open: false, type: null, item: null, fromStage: null })}>
              Cancelar
            </Button>
            <Button 
              onClick={handleMove} 
              disabled={!targetStage || saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <MoveRight className="h-4 w-4 mr-2" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={renameModal.open} onOpenChange={(open) => setRenameModal({ ...renameModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar {renameModal.type === 'deliverable' ? 'Entregable' : 'Documento'}</DialogTitle>
            <DialogDescription>
              Cambiar el nombre para todos los casos en la Etapa {renameModal.stageNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Nombre actual</Label>
              <p className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                {renameModal.item?.deliverableName || renameModal.item?.documentName || renameModal.item?.name?.es}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newNameEs">Nuevo nombre (Español) *</Label>
              <Input
                id="newNameEs"
                value={newName.es}
                onChange={(e) => setNewName({ ...newName, es: e.target.value })}
                placeholder="Nombre en español"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newNameEn">Nuevo nombre (Inglés)</Label>
              <Input
                id="newNameEn"
                value={newName.en}
                onChange={(e) => setNewName({ ...newName, en: e.target.value })}
                placeholder="Nombre en inglés (opcional)"
              />
            </div>
            
            <p className="text-sm text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Este cambio afectará a <strong>{renameModal.item?.count || 0}</strong> casos existentes.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModal({ open: false, type: null, item: null, stageNumber: null })}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRename} 
              disabled={!newName.es || saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Deliverable/Document Dialog */}
      <Dialog open={createModal.open} onOpenChange={(open) => {
        setCreateModal({ ...createModal, open });
        if (!open) {
          setNewItemForm({ name_es: '', name_en: '' });
          setApplyTo('new_only');
          setSelectedCases([]);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {createModal.type === 'deliverable' ? (
                <><Package className="h-5 w-5 text-blue-600" /> Agregar Entregable</>
              ) : (
                <><FileText className="h-5 w-5 text-green-600" /> Agregar Documento</>
              )}
            </DialogTitle>
            <DialogDescription>
              Etapa {createModal.stageNumber} - Elige dónde aplicar este {createModal.type === 'deliverable' ? 'entregable' : 'documento'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Name fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item_name_es" className="text-gray-700">
                  Nombre (Español) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="item_name_es"
                  value={newItemForm.name_es}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name_es: e.target.value })}
                  placeholder={`Nombre del ${createModal.type === 'deliverable' ? 'entregable' : 'documento'}`}
                  className="border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item_name_en" className="text-gray-700">Nombre (Inglés)</Label>
                <Input
                  id="item_name_en"
                  value={newItemForm.name_en}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name_en: e.target.value })}
                  placeholder="English name"
                  className="border-gray-300"
                />
              </div>
            </div>

            {/* Apply To Options */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold text-gray-900">
                ¿Dónde aplicar?
              </Label>
              
              <RadioGroup value={applyTo} onValueChange={(value) => {
                setApplyTo(value);
                if (value !== 'new_only' && allCasesWithStage.length === 0) {
                  fetchCasesWithStage(createModal.stageNumber);
                }
              }}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="new_only" id="create_new_only" />
                  <Label htmlFor="create_new_only" className="flex-1 cursor-pointer">
                    <div className="font-medium">Solo casos nuevos</div>
                    <div className="text-sm text-gray-500">Disponible solo para futuros casos con esta etapa</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="all_cases" id="create_all_cases" />
                  <Label htmlFor="create_all_cases" className="flex-1 cursor-pointer">
                    <div className="font-medium">Todos los casos con Etapa {createModal.stageNumber}</div>
                    <div className="text-sm text-gray-500">Agregar a todos los casos que tienen esta etapa</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="selected_cases" id="create_selected_cases" />
                  <Label htmlFor="create_selected_cases" className="flex-1 cursor-pointer">
                    <div className="font-medium">Casos seleccionados</div>
                    <div className="text-sm text-gray-500">Elegir manualmente qué casos recibirán este item</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Case Selection */}
            {applyTo === 'selected_cases' && (
              <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Seleccionar Casos</Label>
                  <Badge variant="secondary">{selectedCases.length} seleccionados</Badge>
                </div>
                
                {loadingCases ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {allCasesWithStage.map((caseItem) => (
                      <div
                        key={caseItem.id}
                        className="flex items-center space-x-2 p-2 rounded border border-gray-200 bg-white hover:bg-gray-50"
                      >
                        <Checkbox
                          id={`create-case-${caseItem.id}`}
                          checked={selectedCases.includes(caseItem.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCases([...selectedCases, caseItem.id]);
                            } else {
                              setSelectedCases(selectedCases.filter(id => id !== caseItem.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`create-case-${caseItem.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="font-medium">{caseItem.client?.name || 'Sin nombre'}</div>
                          <div className="text-xs text-gray-500">
                            {caseItem.visaType} - {caseItem.visaCategory}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {applyTo === 'all_cases' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Se agregará a todos los casos que tienen la Etapa {createModal.stageNumber}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateModal({ open: false, type: null, stageNumber: null });
                setNewItemForm({ name_es: '', name_en: '' });
                setApplyTo('new_only');
                setSelectedCases([]);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !newItemForm.name_es.trim() || (applyTo === 'selected_cases' && selectedCases.length === 0)}
              className={createModal.type === 'deliverable' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} 
            >
              {saving ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Crear {createModal.type === 'deliverable' ? 'Entregable' : 'Documento'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Deliverable/Document Dialog */}
      <Dialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Eliminar {deleteModal.type === 'deliverable' ? 'Entregable' : 'Documento'}
            </DialogTitle>
            <DialogDescription>
              Esta acción es permanente y no se puede deshacer
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900">
                {deleteModal.item?.name?.es || deleteModal.item?.deliverableName || deleteModal.item?.documentName || 'Item'}
              </p>
              {deleteModal.item?.name?.en && deleteModal.item.name.en !== deleteModal.item.name?.es && (
                <p className="text-sm text-gray-600">
                  EN: {deleteModal.item.name.en}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Etapa {deleteModal.stageNumber}
              </p>
            </div>

            {deleteModal.item?.count > 0 ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 mb-2">
                        Este {deleteModal.type === 'deliverable' ? 'entregable' : 'documento'} está presente en <strong>{deleteModal.item.count} caso{deleteModal.item.count !== 1 ? 's' : ''}</strong>
                      </p>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <Checkbox
                          id="delete-from-cases-item"
                          checked={deleteFromCases}
                          onCheckedChange={setDeleteFromCases}
                        />
                        <Label
                          htmlFor="delete-from-cases-item"
                          className="text-sm text-amber-800 cursor-pointer"
                        >
                          También eliminar de todos los casos
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {!deleteFromCases && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      El template se eliminará pero los casos mantendrán este {deleteModal.type === 'deliverable' ? 'entregable' : 'documento'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">
                  No está siendo utilizado en ningún caso
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModal({ open: false, type: null, item: null, stageNumber: null });
                setDeleteFromCases(true);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
