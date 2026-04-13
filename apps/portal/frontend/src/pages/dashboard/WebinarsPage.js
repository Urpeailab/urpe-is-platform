import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  Play, 
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Award,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const WebinarsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registeredWebinars, setRegisteredWebinars] = useState([]);

  // Fetch webinars from API
  useEffect(() => {
    fetchWebinars();
  }, []);

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/webinars`);
      setWebinars(data.webinars || []);
    } catch (error) {
      console.error('Error fetching webinars:', error);
      toast.error('Error al cargar webinars');
    } finally {
      setLoading(false);
    }
  };

  // Sort all webinars by date (newest first)
  const sortedWebinars = [...webinars].sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA; // Más reciente primero
  });

  const handleRegister = async (webinarId, title) => {
    try {
      if (!user) {
        toast.error('Debes iniciar sesión para registrarte');
        return;
      }

      await axios.post(`${API}/webinars/${webinarId}/register`, {
        userId: user.id,
        email: user.email,
        name: user.name
      });

      setRegisteredWebinars([...registeredWebinars, webinarId]);
      toast.success(`Registrado exitosamente en: ${title}`);
      fetchWebinars(); // Refresh to update count
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al registrarse';
      toast.error(message);
    }
  };

  const handleWatchRecording = (videoUrl, title) => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    } else {
      toast.info(`Próximamente disponible: ${title}`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(t('common.locale'), { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getLevelColor = (level) => {
    switch(level) {
      case 'beginner': return 'bg-success/20 text-success border border-success/30';
      case 'intermediate': return 'bg-gold-primary/20 text-gold-dark border border-gold-dark/30';
      case 'advanced': return 'bg-red-500/20 text-red-600 border border-red-500/30';
      default: return 'bg-navy-primary0/20 text-slate border border-gray-500/30';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-navy-secondary">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 text-gold-subtle" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {t('webinars.title')}
        </h1>
        <p className="text-slate">
          {t('webinars.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gold-primary" />
        </div>
      ) : (
        <>
          {/* Total Count */}
          <div className="flex items-center gap-2 text-slate">
            <BookOpen className="h-5 w-5 text-gold-primary" />
            <span className="font-semibold">{webinars.length}</span> webinars disponibles
          </div>

          {/* All Webinars - Sorted by Date */}
          <div className="space-y-4 mt-6">
          {sortedWebinars.length === 0 ? (
            <Card className="bg-navy-secondary border-2 border-navy-light/20">
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 text-slate-light mx-auto mb-4" />
                <p className="text-slate">No hay webinars disponibles</p>
              </CardContent>
            </Card>
          ) : (
            sortedWebinars.map((webinar) => {
              const isRegistered = registeredWebinars.includes(webinar.id);
              const registeredCount = webinar.registeredCount || 0;
              const capacity = webinar.capacity || 100;
              const isFull = registeredCount >= capacity;
              const availableSpots = capacity - registeredCount;
              const webinarTitle = webinar.title?.es || webinar.title?.en || 'Sin título';
              const webinarDesc = webinar.description?.es || webinar.description?.en || '';
              const presenterName = webinar.presenter?.name || 'Instructor';

              return (
                <Card key={webinar.id} className="bg-navy-secondary border-2 border-gold-dark/50 hover:border-gold-dark transition-all shadow-md">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <CardTitle className="text-xl text-gold-subtle" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {webinarTitle}
                          </CardTitle>
                          {/* Type Badge */}
                          {webinar.type === 'upcoming' ? (
                            <Badge className="bg-blue-500 text-white">
                              <Video className="h-3 w-3 mr-1" />
                              Próximo
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-500 text-white">
                              <Play className="h-3 w-3 mr-1" />
                              Grabado
                            </Badge>
                          )}
                          {isRegistered && webinar.type === 'upcoming' && (
                            <Badge className="bg-success text-white">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Registrado
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-slate">
                          {presenterName}
                        </CardDescription>
                      </div>
                      <Badge className={getLevelColor(webinar.level)}>
                        {webinar.level === 'beginner' ? 'Principiante' : webinar.level === 'intermediate' ? 'Intermedio' : 'Avanzado'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Info Row */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {webinar.date && (
                        <div className="flex items-center gap-2 text-slate">
                          <Calendar className="h-4 w-4 text-gold-primary" />
                          {formatDate(webinar.date)}
                        </div>
                      )}
                      {webinar.time && (
                        <div className="flex items-center gap-2 text-slate">
                          <Clock className="h-4 w-4 text-gold-primary" />
                          {webinar.time} ({webinar.duration || 60} min)
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate">
                        <Users className="h-4 w-4 text-gold-primary" />
                        {registeredCount}/{capacity} registrados
                      </div>
                      <Badge className="bg-navy-light/20 text-gold-subtle border border-navy-light/30">
                        {webinar.language === 'es' ? 'Español' : webinar.language === 'en' ? 'English' : 'Ambos'}
                      </Badge>
                    </div>

                    {/* Description */}
                    {webinarDesc && (
                      <p className="text-slate">
                        {webinarDesc}
                      </p>
                    )}

                    {/* Topics */}
                    {webinar.topics && webinar.topics.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-gold-dark mb-2">
                          Temas:
                        </p>
                        <ul className="space-y-1">
                          {webinar.topics.map((topic, idx) => (
                            <li key={idx} className="text-sm text-slate flex items-start gap-2">
                              <span className="text-gold-primary mt-1">•</span>
                              {topic}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action */}
                    <div className="flex items-center justify-between pt-2">
                      {webinar.type === 'upcoming' ? (
                        <>
                          {!isFull ? (
                            <span className="text-sm text-success">
                              {availableSpots} cupos disponibles
                            </span>
                          ) : (
                            <span className="text-sm text-red-600">
                              Completo
                            </span>
                          )}
                          <Button
                            onClick={() => handleRegister(webinar.id, webinarTitle)}
                            disabled={isRegistered || isFull}
                            className="bg-gold-primary hover:bg-gold-dark text-black font-bold"
                          >
                            {isRegistered ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Registrado
                              </>
                            ) : isFull ? (
                              'Completo'
                            ) : (
                              <>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Registrarse
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge className={getLevelColor(webinar.level)}>
                            {webinar.level === 'beginner' ? 'Principiante' : webinar.level === 'intermediate' ? 'Intermedio' : 'Avanzado'}
                          </Badge>
                          <Button
                            onClick={() => handleWatchRecording(webinar.videoUrl, webinarTitle)}
                            className="bg-gold-primary hover:bg-gold-dark text-black font-bold"
                            size="sm"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Ver Grabación
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
        </>
      )}

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-yellow-500/20 to-transparent border-2 border-gold-dark">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <BookOpen className="h-8 w-8 text-gold-primary flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2 text-gold-subtle" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {t('webinars.banner.title')}
              </h3>
              <p className="text-slate text-sm">
                {t('webinars.banner.description')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
