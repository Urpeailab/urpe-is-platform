import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  FlaskConical, 
  Upload, 
  FileText, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertCircle,
  Download,
  Eye,
  RefreshCw,
  User,
  Calendar,
  TrendingUp,
  Target,
  ArrowRight,
  Award,
  Star,
  Copy,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TestEligibility = () => {
  const [testReports, setTestReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [testName, setTestName] = useState('Test');
  const [testEmail, setTestEmail] = useState('test@urpeintegralservices.co');
  const [notes, setNotes] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showRawData, setShowRawData] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTestReports = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API}/eligibility/test-reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTestReports(data.reports || []);
    } catch (error) {
      console.error('Error fetching test reports:', error);
      toast.error('Error al cargar reportes de prueba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTestReports();
  }, [fetchTestReports]);

  // Parse report data to extract eligibility info
  const parseReportData = (report) => {
    try {
      if (report.reportData?.data) {
        const data = typeof report.reportData.data === 'string' 
          ? JSON.parse(report.reportData.data) 
          : report.reportData.data;
        return data;
      }
      return null;
    } catch (e) {
      console.error('Error parsing report data:', e);
      return null;
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF');
        return;
      }
      setCvFile(file);
      toast.success(`Archivo seleccionado: ${file.name}`);
    }
  };

  const handleUploadAndTest = async () => {
    if (!cvFile) {
      toast.error('Por favor selecciona un archivo CV');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('admin_token');

      toast.info('Subiendo CV...');
      const formData = new FormData();
      formData.append('file', cvFile);
      formData.append('folder', 'test-eligibility-cvs');

      const uploadResponse = await axios.post(
        `${API}/storage/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (!uploadResponse.data.success) {
        throw new Error('Error al subir el archivo');
      }

      const cvUrl = uploadResponse.data.publicUrl || uploadResponse.data.fileUrl;
      toast.success('CV subido exitosamente');

      toast.info('Enviando a N8N para generar reporte de prueba...');
      
      const testResponse = await axios.post(
        `${API}/eligibility/test-report`,
        {
          cvUrl,
          testName: testName || 'Test',
          testEmail: testEmail || 'test@urpeintegralservices.co',
          notes: notes || null
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (testResponse.data.success) {
        toast.success('Reporte de prueba creado exitosamente');
        setCvFile(null);
        setNotes('');
        const fileInput = document.getElementById('cv-file-input');
        if (fileInput) fileInput.value = '';
        fetchTestReports();
      }

    } catch (error) {
      console.error('Error creating test report:', error);
      let errorMsg = 'Error al crear reporte de prueba';
      
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map(err => err.msg || JSON.stringify(err)).join(', ');
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || JSON.stringify(detail);
        } else {
          errorMsg = String(detail);
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (testId) => {
    if (!window.confirm('¿Eliminar este reporte de prueba?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      await axios.delete(`${API}/eligibility/test-reports/${testId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Reporte eliminado');
      fetchTestReports();
    } catch (error) {
      toast.error('Error al eliminar reporte');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completado' },
      processing: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Procesando' },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Fallido' },
      timeout: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle, label: 'Timeout' }
    };
    const config = statusConfig[status] || statusConfig.processing;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Circular progress component - Dark theme style
  const CircularProgress = ({ value, size = 160, strokeWidth = 12, color = '#f59e0b', bgColor = '#374151' }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;
    
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            strokeWidth={strokeWidth}
            stroke={bgColor}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className="transition-all duration-1000 ease-out"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            stroke={color}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-white">{value}%</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-purple-600" />
            Pruebas de Elegibilidad
          </h1>
          <p className="text-gray-600 mt-1">
            Genera reportes de elegibilidad de prueba sin afectar usuarios reales
          </p>
        </div>
        <Button
          onClick={fetchTestReports}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-purple-900">Modo de Prueba</h3>
              <p className="text-purple-700 text-sm">
                Los reportes generados aquí se envían a N8N con el flag <code className="bg-purple-100 px-1 rounded">test: true</code> y 
                <strong> sin número de teléfono</strong>. Los resultados se guardan en la base de datos como registros de prueba.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Upload className="h-5 w-5 text-purple-600" />
            Nueva Prueba de Elegibilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de Prueba
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Test"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de Prueba
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@urpeintegralservices.co"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Prueba con CV de ingeniero, perfil académico fuerte..."
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo CV (PDF)
            </label>
            <div className="flex items-center gap-4">
              <input
                id="cv-file-input"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="flex-1 text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-purple-100 file:text-purple-700
                  hover:file:bg-purple-200
                  cursor-pointer"
              />
              {cvFile && (
                <Badge className="bg-green-100 text-green-800">
                  <FileText className="h-3 w-3 mr-1" />
                  {cvFile.name}
                </Badge>
              )}
            </div>
          </div>

          <Button
            onClick={handleUploadAndTest}
            disabled={!cvFile || uploading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12"
          >
            {uploading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4 mr-2" />
                Generar Reporte de Prueba
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Test Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-900">
              <FileText className="h-5 w-5 text-purple-600" />
              Historial de Pruebas
            </span>
            <Badge className="bg-gray-100 text-gray-700">
              {testReports.length} registros
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, ID o correo..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {testReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay reportes de prueba aún</p>
              <p className="text-sm">Sube un CV para generar tu primer reporte de prueba</p>
            </div>
          ) : (
            <div className="space-y-4">
              {testReports
                .filter((report) => {
                  if (!searchTerm) return true;
                  const search = searchTerm.toLowerCase();
                  const reportData = parseReportData(report);
                  const name = (reportData?.nombreCompleto || report.testName || '').toLowerCase();
                  const email = (report.testEmail || '').toLowerCase();
                  const id = (report.id || '').toLowerCase();
                  
                  return name.includes(search) || email.includes(search) || id.includes(search);
                })
                .map((report) => {
                const reportData = parseReportData(report);
                
                return (
                  <div
                    key={report.id}
                    className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{reportData?.nombreCompleto || report.testName}</h3>
                          {getStatusBadge(report.status)}
                          <Badge className="bg-purple-100 text-purple-700">TEST</Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
                          {/* ID con botón de copiar */}
                          <button
                            onClick={() => {
                              const textArea = document.createElement('textarea');
                              textArea.value = report.id;
                              textArea.style.position = 'fixed';
                              textArea.style.left = '-9999px';
                              document.body.appendChild(textArea);
                              textArea.select();
                              try {
                                document.execCommand('copy');
                                toast.success('ID copiado');
                              } catch (err) {
                                toast.error('Error al copiar');
                              }
                              document.body.removeChild(textArea);
                            }}
                            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded text-xs font-mono transition-colors"
                            title="Clic para copiar ID"
                          >
                            <Copy className="h-3 w-3" />
                            {report.id}
                          </button>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {report.testEmail}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(report.createdAt)}
                          </span>
                        </div>

                        {/* Eligibility Preview */}
                        {reportData && report.status === 'completed' && (
                          <div className="bg-gradient-to-r from-gray-50 to-purple-50 rounded-lg p-4 mt-3">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">Actual</div>
                                <div className="text-3xl font-bold text-gray-700">
                                  {reportData.probabilidadActual || 0}%
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-center justify-center">
                                <div className="flex items-center gap-1 text-green-600">
                                  <TrendingUp className="h-5 w-5" />
                                  <span className="font-bold">+{reportData.incremento || 0}%</span>
                                </div>
                                <ArrowRight className="h-6 w-6 text-purple-500" />
                              </div>
                              
                              <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">Con URPE</div>
                                <div className="text-3xl font-bold text-green-600">
                                  {reportData.probabilidadConServicios || 0}%
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {report.notes && (
                          <p className="text-sm text-gray-500 mt-2 italic">"{report.notes}"</p>
                        )}

                        {report.error && (
                          <p className="text-sm text-red-600 mt-2">Error: {report.error}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {report.cvUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(report.cvUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-700"
                            title="Descargar CV"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {report.reportData && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReport(report)}
                            className="text-purple-600 hover:text-purple-700"
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(report.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Detail Modal - Dark Theme Design (portaled to body to escape AdminLayout's stacking context) */}
      {selectedReport && createPortal(
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedReport(null); }}
        >
          <div className="w-full max-w-4xl bg-[#0f172a] rounded-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-4">
                {/* Logo */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">UIS</div>
                    <div className="text-gray-400 text-xs">Your Path to Success</div>
                  </div>
                </div>
              </div>
              
              {/* Elegible Badge */}
              {(() => {
                const data = parseReportData(selectedReport);
                const probability = data?.probabilidadConServicios || 0;
                const isEligible = probability >= 50;
                
                return (
                  <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                      isEligible 
                        ? 'bg-green-500 text-white' 
                        : 'bg-orange-500 text-white'
                    }`}>
                      {isEligible ? 'Elegible' : 'Bajo Perfil'}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedReport(null);
                        setShowRawData(false);
                        setCopied(false);
                      }}
                      className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
                    >
                      <XCircle className="h-6 w-6" />
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Content */}
            <div className="p-8 overflow-y-auto flex-1">
              {(() => {
                const data = parseReportData(selectedReport);
                
                if (!data) {
                  return (
                    <div className="text-center py-8 text-gray-400">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                      <p>No se pudieron cargar los datos del reporte</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-8">
                    {/* Main Percentages Section */}
                    <div className="flex items-center justify-center gap-8">
                      {/* Actual */}
                      <div className="text-center">
                        <CircularProgress 
                          value={data.probabilidadActual || 0} 
                          color="#f59e0b"
                          bgColor="#374151"
                          size={180}
                          strokeWidth={14}
                        />
                        <p className="mt-4 text-gray-400 uppercase tracking-wider text-sm font-medium">
                          ACTUAL
                        </p>
                      </div>
                      
                      {/* Increment Arrow */}
                      <div className="flex flex-col items-center">
                        <div className="bg-green-600/20 border border-green-500/30 rounded-xl px-6 py-4 text-center">
                          <ArrowRight className="h-6 w-6 text-green-400 mx-auto mb-1" />
                          <span className="text-green-400 font-bold text-2xl">
                            +{data.incremento || 0}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Con URPE */}
                      <div className="text-center">
                        <CircularProgress 
                          value={data.probabilidadConServicios || 0} 
                          color="#22c55e"
                          bgColor="#374151"
                          size={180}
                          strokeWidth={14}
                        />
                        <p className="mt-4 text-gray-400 uppercase tracking-wider text-sm font-medium">
                          CON URPE
                        </p>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-4 mt-8">
                      <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                        <Target className="h-6 w-6 mx-auto text-green-400 mb-2" />
                        <div className="text-2xl font-bold text-white">{data.similitud || 0}%</div>
                        <div className="text-xs text-gray-400 mt-1">Similitud</div>
                      </div>
                      <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                        <Star className="h-6 w-6 mx-auto text-yellow-400 mb-2" />
                        <div className="text-2xl font-bold text-white">{data.casosAnalizados || 0}</div>
                        <div className="text-xs text-gray-400 mt-1">Casos Analizados</div>
                      </div>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div className="grid grid-cols-2 gap-6 mt-6">
                      {/* Strengths */}
                      {data.fortalezasPrincipales && data.fortalezasPrincipales.length > 0 && (
                        <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
                          <h4 className="font-semibold text-green-400 mb-3 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5" />
                            Fortalezas
                          </h4>
                          <ul className="space-y-2">
                            {data.fortalezasPrincipales.slice(0, 3).map((f, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {data.debilidadesActuales && data.debilidadesActuales.length > 0 && (
                        <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-500/30">
                          <h4 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Áreas a Mejorar
                          </h4>
                          <ul className="space-y-2">
                            {data.debilidadesActuales.slice(0, 3).map((d, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Profile Analysis */}
                    {data.analisisPerfil?.resumen && (
                      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 mt-4">
                        <h4 className="font-semibold text-white mb-2">Resumen del Perfil</h4>
                        <p className="text-sm text-gray-400">{data.analisisPerfil.resumen}</p>
                      </div>
                    )}

                    {/* Test Info */}
                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 mt-4">
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>ID: {selectedReport.id}</span>
                        <span>•</span>
                        <span>Email: {selectedReport.testEmail}</span>
                        <span>•</span>
                        <span>Fecha: {formatDate(selectedReport.createdAt)}</span>
                      </div>
                    </div>

                    {/* Raw Data Section */}
                    <div className="mt-6 border-t border-gray-700 pt-6">
                      <button
                        onClick={() => setShowRawData(!showRawData)}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
                      >
                        {showRawData ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                        <span className="font-medium">Ver Data Completa (JSON)</span>
                      </button>

                      {showRawData && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">Data del reporte en formato JSON</span>
                            <Button
                              onClick={() => {
                                const fullData = {
                                  testInfo: {
                                    id: selectedReport.id,
                                    testName: selectedReport.testName,
                                    testEmail: selectedReport.testEmail,
                                    cvUrl: selectedReport.cvUrl,
                                    notes: selectedReport.notes,
                                    status: selectedReport.status,
                                    createdAt: selectedReport.createdAt,
                                    createdBy: selectedReport.createdBy
                                  },
                                  reportData: data,
                                  webhookResponse: selectedReport.webhookResponse
                                };
                                
                                // Método alternativo para copiar al portapapeles
                                const textToCopy = JSON.stringify(fullData, null, 2);
                                const textArea = document.createElement('textarea');
                                textArea.value = textToCopy;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-9999px';
                                textArea.style.top = '-9999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                
                                try {
                                  document.execCommand('copy');
                                  setCopied(true);
                                  toast.success('Data copiada al portapapeles');
                                  setTimeout(() => setCopied(false), 2000);
                                } catch (err) {
                                  console.error('Error al copiar:', err);
                                  toast.error('Error al copiar. Intenta seleccionar y copiar manualmente.');
                                }
                                
                                document.body.removeChild(textArea);
                              }}
                              size="sm"
                              className={`${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                            >
                              {copied ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Copiado!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copiar JSON
                                </>
                              )}
                            </Button>
                          </div>
                          
                          <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 max-h-80 overflow-auto">
                            <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TestEligibility;
