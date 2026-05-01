import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Eye } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const LearningSessionsAudit = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` });

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/admin/learning/sessions`, { headers: headers() });
      setSessions(data.sessions || []);
    } catch {
      toast.error('Error cargando sesiones');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (sessionId) => {
    try {
      setSelected(sessionId);
      setDetailLoading(true);
      const { data } = await axios.get(`${API}/admin/learning/sessions/${sessionId}`, {
        headers: headers(),
      });
      setDetail(data);
    } catch {
      toast.error('Error cargando detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  return (
    <div className="space-y-6 bg-white min-h-screen p-6 text-gray-900">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/admin/learning-admin')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Auditoría de sesiones de aprendizaje</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sesiones recientes ({sessions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando…</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500 italic">Aún no hay sesiones registradas.</p>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${
                      selected === s.id ? 'bg-yellow-50 border-yellow-400' : ''
                    }`}
                    onClick={() => fetchDetail(s.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {s.module_id ? 'Módulo' : 'Conversación libre'}
                      </div>
                      <Badge variant={s.status === 'completed' ? 'default' : 'outline'}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Iniciada: {new Date(s.started_at).toLocaleString('es-MX')}
                    </div>
                    {s.duration_seconds != null && (
                      <div className="text-xs text-gray-500">
                        Duración: {Math.round(s.duration_seconds / 60)} min
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selected ? 'Transcripción' : 'Selecciona una sesión'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-gray-400 italic flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Haz clic en una sesión para ver la transcripción.
              </div>
            ) : detailLoading ? (
              <p className="text-gray-500">Cargando…</p>
            ) : !detail ? (
              <p className="text-gray-500">Sin datos.</p>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {detail.evaluation && (
                  <div className="border-l-4 border-green-500 bg-green-50 p-3 rounded">
                    <div className="text-sm font-semibold">
                      Evaluación: {detail.evaluation.score ?? '—'}/100
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      {detail.evaluation.feedback}
                    </div>
                  </div>
                )}
                {(detail.messages || [])
                  .filter((m) => m.role !== 'system')
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-lg ${
                        m.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
                        {m.role === 'user' ? 'Colaborador' : 'Avatar'}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LearningSessionsAudit;
