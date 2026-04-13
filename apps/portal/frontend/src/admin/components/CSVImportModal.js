import React, { useState } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CSVImportModal = ({ 
  isOpen, 
  onClose, 
  type = 'staff', // 'staff' or 'users'
  onImportComplete 
}) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const config = {
    staff: {
      title: 'Importar Personal',
      templateEndpoint: `${BACKEND_URL}/api/admin/staff/csv-template`,
      importEndpoint: `${BACKEND_URL}/api/admin/staff/import-csv`,
      description: 'Sube un archivo CSV con el personal a importar',
      fields: ['email', 'name', 'role', 'phone', 'department', 'linkedin'],
      exampleRows: [
        'john.doe@example.com,John Doe,advisor,+1234567890,commercial,https://linkedin.com/in/johndoe',
        'jane.smith@example.com,Jane Smith,coordinator,+1234567891,operations,'
      ]
    },
    users: {
      title: 'Importar Clientes',
      templateEndpoint: `${BACKEND_URL}/api/admin/users/csv-template`,
      importEndpoint: `${BACKEND_URL}/api/admin/users/import-csv`,
      description: 'Sube un archivo CSV con los clientes a importar',
      fields: ['email', 'name', 'phone', 'profession', 'userState', 'language'],
      exampleRows: [
        'client@example.com,John Client,+1234567890,Software Engineer,U1,es',
        'client2@example.com,Jane Client,+1234567891,Doctor,U2,en'
      ]
    }
  };

  const currentConfig = config[type];

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
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResults(null);
    } else {
      alert('Por favor selecciona un archivo CSV válido');
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(currentConfig.templateEndpoint, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_import_template.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Error al descargar la plantilla');
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResults(null);

    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        currentConfig.importEndpoint,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setResults(response.data.results);
      
      if (response.data.results.success.length > 0 && onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Error al importar el archivo: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setResults(null);
    setImporting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Upload className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">{currentConfig.title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Instrucciones</h3>
                <p className="text-sm text-blue-800 mb-2">{currentConfig.description}</p>
                <p className="text-sm text-blue-700 mb-2">
                  <strong>Campos requeridos:</strong> {currentConfig.fields.slice(0, 3).join(', ')}
                </p>
                <p className="text-sm text-blue-700">
                  <strong>Campos opcionales:</strong> {currentConfig.fields.slice(3).join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Download Template Button */}
          <div className="mb-6">
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors border-2 border-dashed border-gray-300"
            >
              <Download className="h-5 w-5" />
              <span className="font-medium">Descargar Plantilla CSV</span>
            </button>
          </div>

          {/* File Upload Area */}
          {!results && (
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
              <Upload className={`h-12 w-12 mx-auto mb-4 ${dragActive ? 'text-yellow-500' : 'text-gray-400'}`} />
              {file ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-success">✓ Archivo seleccionado:</p>
                  <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <div className="flex space-x-3 justify-center mt-4">
                    <button
                      onClick={() => setFile(null)}
                      className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      Cambiar archivo
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="px-6 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {importing ? 'Importando...' : 'Importar Ahora'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Arrastra y suelta tu archivo CSV aquí
                  </p>
                  <p className="text-sm text-gray-500 mb-4">o</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    <span className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg cursor-pointer inline-flex items-center space-x-2 transition-colors font-medium">
                      <Upload className="h-4 w-4" />
                      <span>Seleccionar Archivo</span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-600 mb-1">Total Procesados</p>
                  <p className="text-2xl font-bold text-blue-900">{results.total}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-success mb-1">Éxitos</p>
                  <p className="text-2xl font-bold text-green-900">{results.success.length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-600 mb-1">Errores</p>
                  <p className="text-2xl font-bold text-red-900">{results.errors.length}</p>
                </div>
              </div>

              {/* Success List */}
              {results.success.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <h3 className="font-semibold text-green-900">Importados Exitosamente</h3>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {results.success.map((item, idx) => (
                      <div key={idx} className="bg-white rounded p-3 text-sm">
                        <p className="font-medium text-gray-900">{item.name} ({item.email})</p>
                        {item.role && <p className="text-gray-600">Rol: {item.role}</p>}
                        {item.temporaryPassword && (
                          <p className="text-xs text-green-700 font-mono mt-1">
                            Contraseña temporal: {item.temporaryPassword}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error List */}
              {results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-900">Errores en Importación</h3>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {results.errors.map((item, idx) => (
                      <div key={idx} className="bg-white rounded p-3 text-sm">
                        <p className="font-medium text-gray-900">
                          Fila {item.row}: {item.email}
                        </p>
                        <p className="text-red-600">{item.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={resetModal}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
                >
                  Importar Otro Archivo
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVImportModal;
