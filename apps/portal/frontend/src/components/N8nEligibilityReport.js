import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { 
  Target, 
  Award, 
  Book, 
  Smartphone, 
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export const N8nEligibilityReport = ({ report }) => {
  const { t } = useTranslation();

  if (!report) {
    return null;
  }

  // Determine badge color based on badgeColor from report or status
  const getBadgeStyle = () => {
    if (report.badgeColor) {
      return { backgroundColor: report.badgeColor };
    }
    // Fallback to status-based colors
    const status = report.estadoElegibilidad || '';
    if (status.includes('Elegible')) return { backgroundColor: '#10b981' };
    if (status.includes('Potencialmente')) return { backgroundColor: '#f59e0b' };
    return { backgroundColor: '#6b7280' };
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-yellow-500/20 to-transparent border-2 border-yellow-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Reporte de Elegibilidad EB-2 NIW
              </CardTitle>
              <CardDescription className="text-gray-300 text-lg">
                {report.nombreCompleto && (
                  <span>Para: <span className="text-yellow-500 font-semibold">{report.nombreCompleto}</span></span>
                )}
              </CardDescription>
              {report.ocupacion && (
                <p className="text-gray-400 mt-2">{report.ocupacion}</p>
              )}
              {report.fecha && (
                <p className="text-gray-500 text-sm mt-1">Generado: {report.fecha}</p>
              )}
            </div>
            <Badge 
              className="text-white text-sm px-4 py-2" 
              style={getBadgeStyle()}
            >
              {report.estadoElegibilidad || 'En Evaluación'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Tu Probabilidad de Éxito Section */}
      {(report.probabilidadActual || report.probabilidadConServicios) && (
        <Card className="bg-gradient-to-br from-yellow-500/20 to-white border-2 border-yellow-500 overflow-hidden shadow-lg">
          <CardContent className="p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2 text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Tu Probabilidad de Éxito
              </h2>
              <p className="text-gray-600 text-sm">
                Análisis personalizado basado en {report.casosAnalizados?.toLocaleString() || '1,500'} casos similares
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center max-w-5xl mx-auto">
              {/* Current Probability */}
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <svg className="transform -rotate-90 w-44 h-44">
                    <circle
                      cx="88"
                      cy="88"
                      r="80"
                      stroke="currentColor"
                      strokeWidth="14"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="88"
                      cy="88"
                      r="80"
                      stroke="currentColor"
                      strokeWidth="14"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 80}`}
                      strokeDashoffset={`${2 * Math.PI * 80 * (1 - (report.probabilidadActual || 45) / 100)}`}
                      className="text-orange-500 transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-orange-500">
                      {report.probabilidadActual || 45}%
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-1">Actual</div>
                  <div className="text-xs text-gray-500">Sin servicios URPE</div>
                </div>
              </div>

              {/* Arrow and Increment */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  <ArrowRight className="h-12 w-12 text-yellow-500 animate-pulse mb-3" />
                </div>
                <div className="bg-gradient-to-br from-yellow-500/30 to-success/30 border-2 border-yellow-500 rounded-2xl p-5 shadow-lg shadow-yellow-500/20">
                  <div className="text-center">
                    <div className="text-sm text-yellow-600 font-semibold uppercase tracking-wider mb-1">Incremento</div>
                    <div className="text-5xl font-bold text-success">+{report.incremento || 49}%</div>
                  </div>
                </div>
              </div>

              {/* With Services Probability */}
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <svg className="transform -rotate-90 w-44 h-44">
                    <circle
                      cx="88"
                      cy="88"
                      r="80"
                      stroke="currentColor"
                      strokeWidth="14"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="88"
                      cy="88"
                      r="80"
                      stroke="currentColor"
                      strokeWidth="14"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 80}`}
                      strokeDashoffset={`${2 * Math.PI * 80 * (1 - (report.probabilidadConServicios || 94) / 100)}`}
                      className="text-success transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-success">
                      {report.probabilidadConServicios || 94}%
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Con Nuestros Servicios</div>
                  <Badge className="bg-success text-white text-base px-5 py-1.5 shadow-lg shadow-success/30">
                    Muy Alto
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Analysis Section - Moved after Probability */}
      {(report.resumenPerfil || report.puntosFuertes || report.areasAFortalecer) && (
        <Card className="bg-gradient-to-br from-white via-gray-50 to-white border-2 border-gray-200 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <span>📊</span> Análisis de Tu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            {report.resumenPerfil && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Resumen</h3>
                <p className="text-gray-700 leading-relaxed">
                  {report.resumenPerfil}
                </p>
              </div>
            )}

            {/* Two Column Grid for Strengths and Areas to Improve */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Competitive Advantages */}
              {report.puntosFuertes && report.puntosFuertes.length > 0 && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-green-700">Ventajas Competitivas</h4>
                  </div>
                  <ul className="space-y-3">
                    {report.puntosFuertes.map((ventaja, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-success font-bold mt-0.5">•</span>
                        <span>{ventaja}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas Requiring Attention */}
              {report.areasAFortalecer && report.areasAFortalecer.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="text-lg font-bold text-orange-700">Requiere Atención</h4>
                  </div>
                  <ul className="space-y-3">
                    {report.areasAFortalecer.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-700">
                        <span className="text-orange-600 font-bold mt-0.5">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* National Interest Project */}
      {report.proyectoTitulo && (
        <Card className="bg-black border-2 border-yellow-500/50 hover:border-yellow-500 transition-colors">
          <CardHeader>
            <div className="flex items-start space-x-3">
              <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Target className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Proyecto de Interés Nacional
                </CardTitle>
                <CardDescription>Tu propuesta para el NIW</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-yellow-500 mb-2">
                {report.proyectoTitulo}
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                {report.proyectoDescripcion}
              </p>
              {report.proyectoImpacto && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-500 mb-2">Impacto Esperado</p>
                  <p className="text-gray-300 text-sm">
                    {report.proyectoImpacto}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patent */}
      {report.patenteTitulo && (
        <Card className="bg-black border-2 border-blue-500/50 hover:border-blue-500 transition-colors">
          <CardHeader>
            <div className="flex items-start space-x-3">
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Award className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Patente Propuesta
                </CardTitle>
                <CardDescription>Innovación protegida por USPTO</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-blue-400 mb-2">
                {report.patenteTitulo}
              </h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                {report.patenteDescripcion}
              </p>
              {report.patenteEnfoque && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-sm text-blue-400 font-mono">
                    {report.patenteEnfoque}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Book */}
      {report.libroTitulo && (
        <Card className="bg-black border-2 border-purple-500/50 hover:border-purple-500 transition-colors">
          <CardHeader>
            <div className="flex items-start space-x-3">
              <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Book className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Libro Estratégico
                </CardTitle>
                <CardDescription>Publicación profesional</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-purple-400 mb-2">
                {report.libroTitulo}
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                {report.libroDescripcion}
              </p>
              {report.libroCapitulos && report.libroCapitulos.length > 0 && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-purple-400 mb-3">Estructura del Libro</p>
                  <ul className="space-y-2">
                    {report.libroCapitulos.map((chapter, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start">
                        <CheckCircle2 className="h-4 w-4 text-purple-400 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{chapter}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile App */}
      {report.appNombre && (
        <Card className="bg-black border-2 border-success/50 hover:border-success transition-colors">
          <CardHeader>
            <div className="flex items-start space-x-3">
              <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-6 w-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Aplicación Móvil
                </CardTitle>
                <CardDescription>Solución tecnológica</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-success">
                  {report.appNombre}
                </h3>
                <Badge variant="outline" className="border-success/50 text-success">
                  {report.appPlataformas}
                </Badge>
              </div>
              <p className="text-gray-300 leading-relaxed mb-4">
                {report.appDescripcion}
              </p>
              {report.appCaracteristicas && report.appCaracteristicas.length > 0 && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-success mb-3">Características Clave</p>
                  <ul className="space-y-2">
                    {report.appCaracteristicas.map((feature, index) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start">
                        <CheckCircle2 className="h-4 w-4 text-success mr-2 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strengths and Areas to Improve - REMOVED: Now shown in "Análisis de Tu Perfil" section above */}

      {/* Recommendations */}
      {report.recomendaciones && report.recomendaciones.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-500/10 to-transparent border-2 border-yellow-500">
          <CardHeader>
            <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Recomendaciones Estratégicas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <ul className="space-y-3">
                {report.recomendaciones.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start p-3 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                    <CheckCircle2 className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {report.proximosPasos && report.proximosPasos.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-500/10 to-transparent border-2 border-yellow-500">
          <CardHeader>
            <CardTitle className="text-xl flex items-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <ArrowRight className="h-6 w-6 text-yellow-500 mr-2" />
              Próximos Pasos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {report.proximosPasos.map((step, index) => (
                <li key={index} className="flex items-start">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-yellow-500 text-black font-bold text-sm mr-3 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-300">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
