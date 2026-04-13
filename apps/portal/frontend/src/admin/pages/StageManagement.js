import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Edit2, 
  Save, 
  X, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Users,
  Plus,
  Check,
  Trash2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const StageManagement = () => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState(null);
  const [editForm, setEditForm] = useState({ name_es: '', name_en: '', description_es: '', description_en: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, stage: null });
  const [createDialog, setCreateDialog] = useState(false);
  const [newStageForm, setNewStageForm] = useState({ name_es: '', name_en: '', description_es: '', description_en: '' });
  const [applyTo, setApplyTo] = useState('new_only'); // 'new_only', 'all_cases', 'selected_cases'
  const [allCases, setAllCases] = useState([]);
  const [selectedCases, setSelectedCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, stage: null });
  const [deleteFromCases, setDeleteFromCases] = useState(true);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/admin/stage-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error fetching stages');
      
      const data = await response.json();
      setStages(data.stages || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar las etapas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchCases = async () => {
    setLoadingCases(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_URL}/api/admin/cases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error fetching cases');
      
      const data = await response.json();
      setAllCases(data.cases || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar los casos');
    } finally {
      setLoadingCases(false);
    }
  };

  const handleEditClick = (stage) => {
    setEditingStage(stage.stageNumber);
    setEditForm({
      name_es: stage.currentName?.es || '',
      name_en: stage.currentName?.en || '',
      description_es: stage.currentDescription?.es || '',
      description_en: stage.currentDescription?.en || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingStage(null);
    setEditForm({ name_es: '', name_en: '', description_es: '', description_en: '' });
  };

  const handleSaveClick = (stage) => {
    setConfirmDialog({ open: true, stage });
  };

  const handleConfirmSave = async () => {
    const stage = confirmDialog.stage;
    if (!stage) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      
      // Update name
      const nameResponse = await fetch(`${API_URL}/api/admin/stage-templates/${stage.stageNumber}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          stage_number: stage.stageNumber,
          name_es: editForm.name_es,
          name_en: editForm.name_en || editForm.name_es
        })
      });

      if (!nameResponse.ok) {
        const error = await nameResponse.json();
        throw new Error(error.detail || 'Error updating name');
      }

      const nameResult = await nameResponse.json();

      // Update description if changed
      if (editForm.description_es) {
        const descResponse = await fetch(`${API_URL}/api/admin/stage-templates/${stage.stageNumber}/description`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            stage_number: stage.stageNumber,
            description_es: editForm.description_es,
            description_en: editForm.description_en || editForm.description_es
          })
        });

        if (!descResponse.ok) {
          console.warn('Description update failed, but name was updated');
        }
      }

      toast.success(`Etapa ${stage.stageNumber} actualizada`, {
        description: `${nameResult.casesUpdated} casos actualizados`
      });

      setConfirmDialog({ open: false, stage: null });
      setEditingStage(null);
      fetchStages();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar la etapa', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStage = async () => {
    if (!newStageForm.name_es.trim()) {
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
      
      const response = await fetch(`${API_URL}/api/admin/stage-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name_es: newStageForm.name_es,
          name_en: newStageForm.name_en || newStageForm.name_es,
          description_es: newStageForm.description_es,
          description_en: newStageForm.description_en || newStageForm.description_es,
          apply_to: applyTo,
          case_ids: applyTo === 'selected_cases' ? selectedCases : []
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al crear la etapa');
      }

      const result = await response.json();

      let description = `Etapa ${result.stage_number}: ${newStageForm.name_es}`;
      if (result.cases_affected > 0) {
        description += ` - Aplicada a ${result.cases_affected} caso${result.cases_affected !== 1 ? 's' : ''}`;
      }

      toast.success('Nueva etapa creada', { description });

      setCreateDialog(false);
      setNewStageForm({ name_es: '', name_en: '', description_es: '', description_en: '' });
      setApplyTo('new_only');
      setSelectedCases([]);
      fetchStages();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear la etapa', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (stage) => {
    setDeleteDialog({ open: true, stage });
    setDeleteFromCases(true);
  };

  const handleConfirmDelete = async () => {
    const stage = deleteDialog.stage;
    if (!stage) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      
      const response = await fetch(`${API_URL}/api/admin/stage-templates/${stage.stageNumber}?delete_from_cases=${deleteFromCases}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Error al eliminar la etapa');
      }

      const result = await response.json();

      let description = result.message;
      if (result.cases_affected > 0) {
        description += ` - ${result.cases_affected} caso${result.cases_affected !== 1 ? 's afectados' : ' afectado'}`;
      }

      toast.success('Etapa eliminada', { description });

      setDeleteDialog({ open: false, stage: null });
      fetchStages();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar la etapa', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="stage-management-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-blue-500" />
            Gestión de Etapas
          </h1>
          <p className="text-gray-500 mt-1">Edita los nombres de las etapas para todos los casos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva Etapa
          </Button>
          <Button 
            onClick={fetchStages} 
            variant="outline" 
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-800 font-medium">Cambios masivos</p>
          <p className="text-sm text-blue-600">
            Los cambios que realices aquí se aplicarán a <strong>todos los casos</strong> que tengan esa etapa.
            Esta acción no se puede deshacer.
          </p>
        </div>
      </div>

      {/* Stages List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : stages.length === 0 ? (
          <div className="text-center p-12">
            <Layers className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay etapas configuradas</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stages.map((stage) => (
              <div 
                key={stage.stageNumber} 
                className="p-6 hover:bg-gray-50 transition-colors"
                data-testid={`stage-row-${stage.stageNumber}`}
              >
                {editingStage === stage.stageNumber ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <Badge className="bg-blue-100 text-blue-800">
                        Editando Etapa {stage.stageNumber}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          className="text-gray-500"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveClick(stage)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={!editForm.name_es.trim()}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Guardar
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name_es" className="text-gray-700">Nombre (Español) *</Label>
                        <Input
                          id="name_es"
                          value={editForm.name_es}
                          onChange={(e) => setEditForm({ ...editForm, name_es: e.target.value })}
                          placeholder="Ej: Reporte de Elegibilidad"
                          className="border-gray-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name_en" className="text-gray-700">Nombre (Inglés)</Label>
                        <Input
                          id="name_en"
                          value={editForm.name_en}
                          onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })}
                          placeholder="Ej: Eligibility Report"
                          className="border-gray-300"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="desc_es" className="text-gray-700">Descripción (Español)</Label>
                        <Textarea
                          id="desc_es"
                          value={editForm.description_es}
                          onChange={(e) => setEditForm({ ...editForm, description_es: e.target.value })}
                          placeholder="Descripción de la etapa..."
                          className="border-gray-300"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="desc_en" className="text-gray-700">Descripción (Inglés)</Label>
                        <Textarea
                          id="desc_en"
                          value={editForm.description_en}
                          onChange={(e) => setEditForm({ ...editForm, description_en: e.target.value })}
                          placeholder="Stage description..."
                          className="border-gray-300"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                        {stage.stageNumber}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {stage.currentName?.es || `Etapa ${stage.stageNumber}`}
                        </h3>
                        {stage.currentName?.en && stage.currentName.en !== stage.currentName?.es && (
                          <p className="text-sm text-gray-500">
                            EN: {stage.currentName.en}
                          </p>
                        )}
                        {stage.currentDescription?.es && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                            {stage.currentDescription.es}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Users className="h-4 w-4" />
                          <span>{stage.totalCases} casos</span>
                        </div>
                        {stage.hasVariations && (
                          <Badge className="bg-yellow-100 text-yellow-800 mt-1">
                            Variaciones
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(stage)}
                          className="border-gray-300 hover:bg-gray-100"
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteClick(stage)}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambio masivo</DialogTitle>
            <DialogDescription>
              Estás a punto de cambiar el nombre de la <strong>Etapa {confirmDialog.stage?.stageNumber}</strong> a:
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm">
                <strong>Español:</strong> {editForm.name_es}
              </p>
              {editForm.name_en && (
                <p className="text-sm">
                  <strong>Inglés:</strong> {editForm.name_en}
                </p>
              )}
            </div>
            <p className="text-sm text-amber-600 mt-4 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Este cambio afectará a <strong>{confirmDialog.stage?.totalCases} casos</strong> existentes.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, stage: null })}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar cambio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create New Stage Dialog */}
      <Dialog open={createDialog} onOpenChange={(open) => {
        setCreateDialog(open);
        if (open && applyTo !== 'new_only') {
          fetchCases();
        }
        if (!open) {
          setApplyTo('new_only');
          setSelectedCases([]);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Crear Nueva Etapa
            </DialogTitle>
            <DialogDescription>
              Define la nueva etapa y elige dónde aplicarla
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Stage Name and Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_name_es" className="text-gray-700">
                  Nombre (Español) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new_name_es"
                  value={newStageForm.name_es}
                  onChange={(e) => setNewStageForm({ ...newStageForm, name_es: e.target.value })}
                  placeholder="Ej: Revisión de Documentos"
                  className="border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_name_en" className="text-gray-700">Nombre (Inglés)</Label>
                <Input
                  id="new_name_en"
                  value={newStageForm.name_en}
                  onChange={(e) => setNewStageForm({ ...newStageForm, name_en: e.target.value })}
                  placeholder="Ej: Document Review"
                  className="border-gray-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_desc_es" className="text-gray-700">Descripción (Español)</Label>
                <Textarea
                  id="new_desc_es"
                  value={newStageForm.description_es}
                  onChange={(e) => setNewStageForm({ ...newStageForm, description_es: e.target.value })}
                  placeholder="Descripción de la etapa..."
                  className="border-gray-300"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_desc_en" className="text-gray-700">Descripción (Inglés)</Label>
                <Textarea
                  id="new_desc_en"
                  value={newStageForm.description_en}
                  onChange={(e) => setNewStageForm({ ...newStageForm, description_en: e.target.value })}
                  placeholder="Stage description..."
                  className="border-gray-300"
                  rows={2}
                />
              </div>
            </div>

            {/* Apply To Options */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold text-gray-900">
                ¿Dónde aplicar esta etapa?
              </Label>
              
              <RadioGroup value={applyTo} onValueChange={(value) => {
                setApplyTo(value);
                if (value !== 'new_only' && allCases.length === 0) {
                  fetchCases();
                }
              }}>
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="new_only" id="new_only" />
                  <Label htmlFor="new_only" className="flex-1 cursor-pointer">
                    <div className="font-medium">Solo casos nuevos</div>
                    <div className="text-sm text-gray-500">La etapa estará disponible solo para casos futuros</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="all_cases" id="all_cases" />
                  <Label htmlFor="all_cases" className="flex-1 cursor-pointer">
                    <div className="font-medium">Todos los casos existentes</div>
                    <div className="text-sm text-gray-500">Agregar esta etapa a todos los casos activos</div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <RadioGroupItem value="selected_cases" id="selected_cases" />
                  <Label htmlFor="selected_cases" className="flex-1 cursor-pointer">
                    <div className="font-medium">Casos seleccionados</div>
                    <div className="text-sm text-gray-500">Elige manualmente qué casos recibirán esta etapa</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Case Selection (if selected_cases) */}
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
                    {allCases.map((caseItem) => (
                      <div
                        key={caseItem.id}
                        className="flex items-center space-x-2 p-2 rounded border border-gray-200 bg-white hover:bg-gray-50"
                      >
                        <Checkbox
                          id={`case-${caseItem.id}`}
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
                          htmlFor={`case-${caseItem.id}`}
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

            {/* Warning Messages */}
            {applyTo === 'all_cases' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <strong>Atención:</strong> Esta etapa se agregará a <strong>todos los casos existentes</strong>. 
                  Esta acción no se puede deshacer.
                </p>
              </div>
            )}

            {applyTo === 'new_only' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  La nueva etapa estará disponible inmediatamente para casos futuros.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialog(false);
                setNewStageForm({ name_es: '', name_en: '', description_es: '', description_en: '' });
                setApplyTo('new_only');
                setSelectedCases([]);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateStage}
              disabled={saving || !newStageForm.name_es.trim() || (applyTo === 'selected_cases' && selectedCases.length === 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Etapa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Stage Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Eliminar Etapa {deleteDialog.stage?.stageNumber}
            </DialogTitle>
            <DialogDescription>
              Esta acción es permanente y no se puede deshacer
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900">
                {deleteDialog.stage?.currentName?.es || `Etapa ${deleteDialog.stage?.stageNumber}`}
              </p>
              {deleteDialog.stage?.currentName?.en && (
                <p className="text-sm text-gray-600">
                  {deleteDialog.stage.currentName.en}
                </p>
              )}
            </div>

            {deleteDialog.stage?.totalCases > 0 ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 mb-2">
                        Esta etapa está presente en <strong>{deleteDialog.stage.totalCases} caso{deleteDialog.stage.totalCases !== 1 ? 's' : ''}</strong>
                      </p>
                      
                      <div className="flex items-center space-x-2 mt-3">
                        <Checkbox
                          id="delete-from-cases"
                          checked={deleteFromCases}
                          onCheckedChange={setDeleteFromCases}
                        />
                        <Label
                          htmlFor="delete-from-cases"
                          className="text-sm text-amber-800 cursor-pointer"
                        >
                          También eliminar esta etapa de todos los casos
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {!deleteFromCases && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      La plantilla se eliminará pero los casos mantendrán esta etapa
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700">
                  Esta etapa no está siendo utilizada en ningún caso
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialog({ open: false, stage: null });
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
                  Eliminar Etapa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
