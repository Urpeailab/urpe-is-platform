import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  CheckCircle2,
  MapPin,
  Briefcase,
  Clock,
  Award,
  TrendingUp,
  Filter,
  Search,
  Star,
  ArrowRight,
  Loader2,
  User,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BarChart3
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SuccessStoriesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    professions: [],
    countries: [],
    visas: [],
    statuses: []
  });
  const [selectedProfession, setSelectedProfession] = useState('all');
  const [selectedVisa, setSelectedVisa] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [expandedStory, setExpandedStory] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (selectedProfession !== 'all') params.append('profession', selectedProfession);
      if (selectedVisa !== 'all') params.append('visa', selectedVisa);
      if (selectedCountry !== 'all') params.append('country', selectedCountry);

      const response = await fetch(`${API_URL}/api/success-stories/public?${params}`);
      
      if (!response.ok) throw new Error('Error al cargar historias');
      
      const data = await response.json();
      setStories(data.stories || []);
      setFilters(data.filters || { professions: [], countries: [], visas: [], statuses: [] });
    } catch (error) {
      console.error('Error fetching stories:', error);
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProfession, selectedVisa, selectedCountry]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  useEffect(() => {
    setVisibleCount(12);
  }, [selectedProfession, selectedVisa, selectedCountry]);

  const featuredStories = stories.filter(s => s.featured).slice(0, 4);
  const visibleStories = stories.slice(0, visibleCount);

  const getPhotoUrl = (story) => {
    if (!story.photo) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.name}&backgroundColor=ffc700`;
    if (story.photo.startsWith('/api/')) return `${API_URL}${story.photo}`;
    return story.photo;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-gold-primary mx-auto mb-4" />
          <p className="text-slate-light">Cargando casos de exito...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-navy-secondary" data-testid="success-stories-page">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 flex items-center gap-3 text-gold-subtle" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Award className="h-7 w-7 text-gold-primary" />
            Casos de Exito
          </h1>
          <p className="text-slate text-sm">
            Historias reales de profesionales que lograron su visa con URPE
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center px-4 py-2 bg-gold-primary/10 border border-gold-dark/30 rounded-lg">
            <span className="text-2xl font-bold text-gold-primary">{stories.length}</span>
            <p className="text-xs text-slate">Aprobados</p>
          </div>
        </div>
      </div>

      {/* Featured carousel */}
      {featuredStories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {featuredStories.map((story) => (
            <Card 
              key={story.id} 
              className="bg-gradient-to-b from-gold-primary/10 to-navy-secondary border border-gold-dark/40 hover:border-gold-primary transition-all cursor-pointer group"
              onClick={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
              data-testid={`featured-story-${story.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img 
                    src={getPhotoUrl(story)}
                    alt={story.name}
                    className="h-12 w-12 rounded-full border-2 border-gold-primary object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-gold-primary fill-gold-primary flex-shrink-0" />
                      <h4 className="font-semibold text-sm text-gold-subtle truncate">{story.name}</h4>
                    </div>
                    <p className="text-xs text-slate truncate">{story.profession}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-light">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{story.country}</span>
                  <Badge className="bg-gold-primary/20 text-gold-primary border-0 text-xs px-1.5">{story.visa}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="bg-navy-secondary border border-gold-dark/30" data-testid="stories-filters">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gold-primary" />
            <h3 className="font-semibold text-sm text-gold-subtle">Filtros</h3>
            <span className="text-xs text-slate-light ml-auto">
              {stories.length} resultados
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select 
              value={selectedProfession}
              onChange={(e) => setSelectedProfession(e.target.value)}
              className="w-full bg-navy-secondary border border-navy-light/30 rounded-lg px-3 py-2 text-sm text-gold-subtle focus:border-gold-dark focus:ring-1 focus:ring-gold-dark/50"
              data-testid="filter-profession"
            >
              <option value="all">Todas las profesiones</option>
              {filters.professions.map(prof => (
                <option key={prof} value={prof}>{prof}</option>
              ))}
            </select>
            <select 
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full bg-navy-secondary border border-navy-light/30 rounded-lg px-3 py-2 text-sm text-gold-subtle focus:border-gold-dark focus:ring-1 focus:ring-gold-dark/50"
              data-testid="filter-country"
            >
              <option value="all">Todos los paises</option>
              {filters.countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select 
              value={selectedVisa}
              onChange={(e) => setSelectedVisa(e.target.value)}
              className="w-full bg-navy-secondary border border-navy-light/30 rounded-lg px-3 py-2 text-sm text-gold-subtle focus:border-gold-dark focus:ring-1 focus:ring-gold-dark/50"
              data-testid="filter-visa"
            >
              <option value="all">Todos los tipos</option>
              {filters.visas.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          {(selectedProfession !== 'all' || selectedVisa !== 'all' || selectedCountry !== 'all') && (
            <div className="mt-2 flex justify-end">
              <Button 
                size="sm" variant="ghost"
                onClick={() => { setSelectedProfession('all'); setSelectedVisa('all'); setSelectedCountry('all'); }}
                className="text-gold-primary text-xs h-7"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="stories-grid">
        {visibleStories.map((story) => {
          const isExpanded = expandedStory === story.id;
          return (
            <Card 
              key={story.id} 
              className={`bg-navy-secondary border transition-all cursor-pointer hover:shadow-lg ${isExpanded ? 'border-gold-primary shadow-gold-primary/10' : 'border-gold-dark/30 hover:border-gold-dark/60'}`}
              onClick={() => setExpandedStory(isExpanded ? null : story.id)}
              data-testid={`story-card-${story.id}`}
            >
              <CardContent className="p-4">
                {/* Top row: photo + basic info */}
                <div className="flex items-start gap-3 mb-3">
                  <img 
                    src={getPhotoUrl(story)}
                    alt={story.name}
                    className="h-14 w-14 rounded-full border-2 border-gold-dark/60 object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-gold-subtle truncate">{story.name}</h3>
                    <p className="text-xs text-slate flex items-center gap-1 mt-0.5">
                      <Briefcase className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{story.profession}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-light flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{story.country}
                      </span>
                      {story.age && (
                        <span className="text-xs text-slate-light flex items-center gap-1">
                          <User className="h-3 w-3" />{story.age} anos
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {story.visa}
                  </Badge>
                  {story.processingTime && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {story.processingTime}
                    </Badge>
                  )}
                  {story.score && (
                    <Badge className="bg-gold-primary/20 text-gold-primary border-0 text-xs">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {story.score}% inicial
                    </Badge>
                  )}
                </div>

                {/* Previous status + project */}
                {story.previousStatus && (
                  <div className="flex items-center gap-1 text-xs text-slate-light mb-1">
                    <ShieldCheck className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    <span>Estatus previo: <span className="text-slate">{story.previousStatus}</span></span>
                  </div>
                )}
                {story.projectName && (
                  <div className="flex items-center gap-1 text-xs text-slate-light mb-2">
                    <FileText className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">{story.projectName}</span>
                  </div>
                )}

                {/* Expand indicator */}
                <div className="flex items-center justify-center pt-1 border-t border-navy-light/20">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gold-primary" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-light" />
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gold-dark/20 space-y-3 animate-in fade-in duration-200">
                    {story.quote && (
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-sm text-gray-700 italic leading-relaxed">
                          &ldquo;{story.quote}&rdquo;
                        </p>
                        <p className="text-xs text-gray-400 mt-2 text-right">— {story.name}</p>
                      </div>
                    )}

                    {story.keyAdvice && story.keyAdvice.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-xs mb-2 flex items-center gap-1 text-gold-subtle">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          Consejos clave
                        </h4>
                        <ul className="space-y-1.5">
                          {story.keyAdvice.map((advice, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-xs">
                              <ArrowRight className="h-3 w-3 text-gold-primary flex-shrink-0 mt-0.5" />
                              <span className="text-slate">{advice}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Load more */}
      {visibleCount < stories.length && (
        <div className="flex justify-center">
          <Button 
            onClick={(e) => { e.stopPropagation(); setVisibleCount(prev => prev + 12); }}
            className="bg-gold-primary/20 hover:bg-gold-primary/30 text-gold-primary border border-gold-dark/40"
            data-testid="load-more-btn"
          >
            Ver mas casos ({stories.length - visibleCount} restantes)
          </Button>
        </div>
      )}

      {/* No Results */}
      {stories.length === 0 && !loading && (
        <Card className="bg-navy-secondary border border-gold-dark/30">
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-slate mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2 text-gold-subtle">No se encontraron casos</h3>
            <p className="text-slate-light text-sm mb-4">Intenta ajustando los filtros de busqueda</p>
            <Button 
              onClick={() => { setSelectedProfession('all'); setSelectedVisa('all'); setSelectedCountry('all'); }}
              className="bg-gold-primary hover:bg-gold-dark text-black font-bold"
              data-testid="reset-filters-btn"
            >
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
