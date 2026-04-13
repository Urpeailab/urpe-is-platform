import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  Search, 
  Bot, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Globe, 
  ExternalLink,
  Clock,
  Zap
} from 'lucide-react';

export const SpyDashboard = () => {
  const features = [
    { icon: Search, title: 'Scraping Multi-Plataforma', description: 'Meta, Google Ads, TikTok, LinkedIn, X' },
    { icon: Bot, title: 'Análisis con IA', description: 'Google Gemini Multimodal' },
    { icon: TrendingUp, title: 'Funnel Analysis', description: 'Atención → Confianza → Conversión' },
    { icon: Target, title: 'Hook Detection', description: 'Ganchos publicitarios efectivos' },
    { icon: BarChart3, title: 'Dashboard Unificado', description: 'Inteligencia competitiva centralizada' },
    { icon: Globe, title: 'Bilingüe', description: 'Español e Inglés' }
  ];

  const techStack = [
    { name: 'Frontend', value: 'React + TailwindCSS' },
    { name: 'Backend', value: 'FastAPI (Python)' },
    { name: 'Base de Datos', value: 'Supabase (PostgreSQL)' },
    { name: 'IA', value: 'Google Gemini' },
    { name: 'Scraping', value: 'Firecrawl' }
  ];

  return (
    <div className="space-y-6" data-testid="spy-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Eye className="h-6 w-6 text-yellow-600" />
            Monica Spy
          </h1>
          <p className="text-gray-600 mt-1">Plataforma de Inteligencia Competitiva de Anuncios</p>
        </div>
        <Button 
          onClick={() => window.open('https://brand-makeover-11.emergent.host/', '_blank')}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
          data-testid="spy-launch-button"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Ir a Monica Spy
        </Button>
      </div>

      {/* Problema / Solución */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <Clock className="h-4 w-4" />
              Problema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">
              Análisis manual de anuncios consume <span className="font-bold">+4 horas diarias</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-300 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-green-800">
              <Zap className="h-4 w-4" />
              Solución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700">
              Monica Spy automatiza todo en <span className="font-bold">minutos</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funcionalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Funcionalidades</CardTitle>
          <CardDescription className="text-gray-600">Capacidades principales de la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                <feature.icon className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-900">{feature.title}</p>
                  <p className="text-xs text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tech Stack y Audiencia */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Stack Tecnológico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {techStack.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                <span className="text-sm text-gray-700">{item.name}</span>
                <span className="text-sm font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-gray-900">Para quién es</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-900">Agencias de Marketing</span>
              <span className="text-xs text-gray-600">Análisis para clientes</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-900">Equipos de Growth</span>
              <span className="text-xs text-gray-600">Estrategias exitosas</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-sm text-gray-900">Media Buyers</span>
              <span className="text-xs text-gray-600">Creativos ganadores</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-900">Social Media Managers</span>
              <span className="text-xs text-gray-600">Tendencias creativas</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SpyDashboard;
