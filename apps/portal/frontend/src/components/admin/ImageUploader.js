import React, { useState, useRef } from 'react';
import { Upload, X, Image, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const ImageUploader = ({ 
  value, 
  onChange, 
  label = "Imagen",
  helpText = "",
  folder = "success-stories",
  accept = "image/*",
  maxSizeMB = 5
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

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
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }

    // Validar tamaño
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`El archivo es muy grande. Máximo ${maxSizeMB}MB`);
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('admin_token');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const response = await fetch(`${BACKEND_URL}/api/storage/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }

      const data = await response.json();
      onChange(data.publicUrl || data.url);
      toast.success('Imagen subida correctamente');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-gray-900 font-semibold text-sm">{label}</label>
      
      {value ? (
        // Preview de imagen subida
        <div className="relative border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50">
          <img 
            src={value} 
            alt="Preview" 
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              <Upload className="h-4 w-4 mr-1" />
              Cambiar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRemove}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              <X className="h-4 w-4 mr-1" />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        // Zona de arrastrar y soltar
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-gray-300 hover:border-yellow-400 bg-gray-50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="h-10 w-10 mx-auto text-yellow-500 animate-spin" />
              <p className="text-sm text-gray-600">Subiendo imagen...</p>
            </div>
          ) : (
            <div>
              <Image className={`h-10 w-10 mx-auto mb-3 ${dragActive ? 'text-yellow-500' : 'text-gray-400'}`} />
              <p className="text-gray-600 text-sm mb-1">
                Arrastra una imagen aquí
              </p>
              <p className="text-xs text-gray-500 mb-3">o</p>
              <span className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg inline-flex items-center space-x-2 transition-colors font-medium text-sm">
                <Upload className="h-4 w-4" />
                <span>Seleccionar Imagen</span>
              </span>
              <p className="text-xs text-gray-500 mt-3">
                PNG, JPG, WebP (máx. {maxSizeMB}MB)
              </p>
            </div>
          )}
        </div>
      )}
      
      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
};

export default ImageUploader;
