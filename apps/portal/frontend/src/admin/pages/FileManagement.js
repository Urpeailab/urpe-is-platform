import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FolderOpen,
  Download,
  Trash2,
  Search,
  Filter,
  FileText,
  Image,
  File,
  HardDrive,
  AlertCircle,
  ExternalLink,
  Calendar,
  Folder
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const FileManagement = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFolder, setFilterFolder] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSizeMB: 0,
    byFolder: {},
    byType: {}
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(
        `${BACKEND_URL}/api/storage/files`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setFiles(data.files || []);
      setStats(data.stats || {});
      setLoading(false);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Error al cargar los archivos');
      setLoading(false);
    }
  };

  const handleDelete = async (file) => {
    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(
        `${BACKEND_URL}/api/storage/files/${encodeURIComponent(file.path)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Archivo eliminado exitosamente');
      setDeleteConfirm(null);
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Error al eliminar el archivo');
    }
  };

  // Derive filtered files using useMemo
  const filteredFiles = useMemo(() => {
    let filtered = [...files];

    // Filter by folder
    if (filterFolder !== 'all') {
      filtered = filtered.filter(f => f.folder === filterFolder);
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(f => f.mimeType.includes(filterType));
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(f =>
        f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.path?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [files, filterFolder, filterType, searchTerm]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.includes('image')) return <Image className="h-5 w-5 text-blue-500" />;
    if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const getFileTypeBadge = (mimeType) => {
    if (mimeType.includes('image')) return <Badge className="bg-blue-100 text-blue-800">Imagen</Badge>;
    if (mimeType.includes('pdf')) return <Badge className="bg-red-100 text-red-800">PDF</Badge>;
    if (mimeType.includes('word')) return <Badge className="bg-blue-100 text-blue-800">Word</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">Archivo</Badge>;
  };

  // Get unique folders and types for filters
  const folders = useMemo(() => {
    const uniqueFolders = [...new Set(files.map(f => f.folder))];
    return uniqueFolders.sort();
  }, [files]);

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(files.map(f => {
      if (f.mimeType.includes('image')) return 'image';
      if (f.mimeType.includes('pdf')) return 'pdf';
      if (f.mimeType.includes('word')) return 'word';
      return 'other';
    }))];
    return uniqueTypes;
  }, [files]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando archivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Gestión de Archivos
          </h1>
          <p className="text-gray-600 mt-1">Administra todos los archivos del sistema</p>
        </div>
        <Button
          onClick={fetchFiles}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <HardDrive className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Files */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalFiles || 0}</div>
            </div>
          </CardContent>
        </Card>

        {/* Total Storage */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Almacenamiento Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <HardDrive className="h-5 w-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalSizeMB?.toFixed(2) || 0} MB</div>
            </div>
          </CardContent>
        </Card>

        {/* Folders */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Carpetas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Folder className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{folders.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por archivo, usuario, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Folder Filter */}
            <div className="relative">
              <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterFolder}
                onChange={(e) => setFilterFolder(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">Todas las carpetas</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">Todos los tipos</option>
                <option value="image">Imágenes</option>
                <option value="pdf">PDFs</option>
                <option value="word">Word</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{filteredFiles.length}</span> de{' '}
              <span className="font-semibold">{files.length}</span> archivos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Files Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lista de Archivos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Archivo</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Usuario</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Carpeta</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tamaño</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fecha</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-gray-500">
                      No se encontraron archivos
                    </td>
                  </tr>
                ) : (
                  filteredFiles.map((file) => (
                    <tr key={file.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.mimeType)}
                          <div>
                            <p className="font-medium text-gray-900 truncate max-w-xs" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-xs" title={file.path}>
                              {file.path}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{file.userName || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{file.userEmail || ''}</p>
                          {file.uploadedBy && (
                            <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                              {file.uploadedBy}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <Badge className="bg-purple-100 text-purple-800">{file.folder}</Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">{getFileTypeBadge(file.mimeType)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(file.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => window.open(file.url, '_blank')}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setDeleteConfirm(file)}
                            className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
                          >
                            <Trash2 className="h-3 w-3" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardHeader className="bg-red-50 border-b border-red-200">
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Confirmar Eliminación
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-gray-700">
                ¿Estás seguro de que deseas eliminar este archivo?
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{deleteConfirm.name}</p>
                <p className="text-xs text-gray-500 mt-1">{deleteConfirm.path}</p>
              </div>
              <p className="text-sm text-red-600 font-medium">
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
