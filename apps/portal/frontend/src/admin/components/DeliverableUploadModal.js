import React, { useState } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { X, Upload, Loader2, File, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const DeliverableUploadModal = ({ isOpen, onClose, deliverable, caseId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // Helper function to extract text from bilingual objects
  const getText = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object') return field.es || field.en || '';
    return '';
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      // No establecemos fileUrl aquí - se subirá cuando se envíe el formulario
      setFileUrl('');
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file && !fileUrl) {
      toast.error('Por favor selecciona un archivo');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('admin_token');

      let finalFileUrl = fileUrl;
      let fileName = file?.name || 'document.pdf';
      let fileSize = file?.size || 0;

      // Si hay un archivo, primero subirlo al servidor
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await axios.post(
          `${BACKEND_URL}/api/admin/deliverables/upload-file`,
          formData,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        finalFileUrl = uploadResponse.data.fileUrl;
        fileName = uploadResponse.data.fileName;
        fileSize = uploadResponse.data.fileSize;
      }
      
      // Ahora guardar la información del entregable
      const requestData = {
        caseId: caseId,
        stageNumber: deliverable.stageNumber,
        deliverableId: deliverable._id || deliverable.id,
        fileName: fileName,
        fileUrl: finalFileUrl,
        fileSize: fileSize,
        notes: notes
      };

      await axios.post(
        `${BACKEND_URL}/api/admin/deliverables/upload`,
        requestData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Entregable subido exitosamente');
      onUploadComplete();
      resetForm();
    } catch (error) {
      console.error('Error uploading deliverable:', error);
      toast.error(error.response?.data?.detail || 'Error al subir el entregable');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setFileUrl('');
    setNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Subir Entregable
            </h2>
            <p className="text-yellow-100 text-sm mt-1">
              {deliverable?.deliverableName || getText(deliverable?.name) || 'Sin nombre'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Description */}
          {(deliverable?.description?.es || deliverable?.description?.en || deliverable?.description) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900">
                <strong>Descripción:</strong> {getText(deliverable?.description)}
              </p>
            </div>
          )}

          {/* File Upload Area */}
          <div className="space-y-4">
            <Label>Archivo del Entregable *</Label>
            
            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? 'border-yellow-500 bg-yellow-50'
                  : 'border-gray-300 hover:border-yellow-400 bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-2">
                  <File className="h-12 w-12 mx-auto text-success" />
                  <p className="text-sm font-medium text-success">✓ Archivo seleccionado:</p>
                  <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300"
                  >
                    Cambiar archivo
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className={`h-12 w-12 mx-auto mb-4 ${dragActive ? 'text-yellow-500' : 'text-gray-400'}`} />
                  <p className="text-gray-600 mb-2">
                    Arrastra y suelta tu archivo aquí
                  </p>
                  <p className="text-sm text-gray-500 mb-4">o</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.mkv,.webm"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <span className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors font-medium">
                      <Upload className="h-4 w-4" />
                      <span>Seleccionar Archivo</span>
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-4">
                    PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX · JPG, PNG, GIF, WEBP · MP4, MOV, AVI, MKV
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas (Opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Agrega notas sobre este entregable..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Warning Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Importante:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>El archivo se marcará como BORRADOR hasta que el cliente pague la etapa</li>
                    <li>Una vez pagado, el cliente podrá descargar la versión final sin marca de agua</li>
                    <li>Asegúrate de que el documento esté completo antes de subirlo</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 mt-6 border-t">
            <Button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300 font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold shadow-sm"
              disabled={uploading || (!file && !fileUrl)}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Entregable
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliverableUploadModal;
