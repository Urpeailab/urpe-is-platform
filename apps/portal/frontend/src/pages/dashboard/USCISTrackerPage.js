import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Loader2, AlertCircle, Clock, ChevronRight, FileText } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  approved: { dot: '#34C759', border: '#34C759' },
  processing: { dot: '#007AFF', border: '#3D5A8A' },
  reviewing: { dot: '#007AFF', border: '#3D5A8A' },
  received: { dot: '#007AFF', border: '#007AFF' },
  rfe: { dot: '#FF9500', border: '#FF9500' },
  denied: { dot: '#FF3B30', border: '#FF3B30' },
  unknown: { dot: '#8E8E93', border: '#C6C6C8' },
};

const daysAgo = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

export const USCISTrackerPage = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const token = JSON.parse(localStorage.getItem('urpe_user') || '{}')?.token;

  const fetchCases = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/api/uscis/cases`, { headers: { Authorization: `Bearer ${token}` } });
      setCases(data.cases || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      for (const c of cases) {
        await axios.post(`${API}/api/uscis/cases/${c.receiptNumber}/refresh`, {}, { headers: { Authorization: `Bearer ${token}` } });
      }
      toast.success('Casos actualizados');
      fetchCases();
    } catch { toast.error('Error al actualizar'); }
    finally { setRefreshing(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#EEF1F5' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1C3A6B' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-8" style={{ background: '#EEF1F5' }}>
      {/* Header */}
      <div style={{ background: '#1C3A6B' }} className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard/my-case')} className="text-white text-sm flex items-center gap-1 opacity-80 hover:opacity-100">
          <ChevronRight className="h-4 w-4 rotate-180" />Mi Caso
        </button>
        <h1 className="text-white font-bold text-lg">USCIS Status</h1>
        <button onClick={handleRefreshAll} disabled={refreshing} className="text-white opacity-80 hover:opacity-100">
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-4 sm:px-6 py-4 max-w-2xl mx-auto">
        {cases.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm mt-4">
            <FileText className="h-12 w-12 mx-auto mb-3" style={{ color: '#C6C6C8' }} />
            <p className="font-semibold" style={{ color: '#1C3A6B' }}>No hay casos USCIS registrados</p>
            <p className="text-sm mt-1" style={{ color: '#8E8E93' }}>
              Tu abogado agregara tu numero de recibo una vez que tu peticion sea presentada.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="text-xs" style={{ color: '#8E8E93' }}>
              {cases.length} caso{cases.length !== 1 ? 's' : ''} registrado{cases.length !== 1 ? 's' : ''}
            </p>
            {cases.map((c) => {
              const colors = STATUS_COLORS[c.status] || STATUS_COLORS.unknown;
              const days = daysAgo(c.lastStatusChangeAt);
              return (
                <button
                  key={c.receiptNumber}
                  onClick={() => navigate(`/dashboard/uscis-case/${c.receiptNumber}`)}
                  className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                  style={{ borderLeft: `4px solid ${colors.border}` }}
                  data-testid={`uscis-case-${c.receiptNumber}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-bold text-sm" style={{ color: '#000' }}>{c.receiptNumber}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: '#8E8E93' }}>{c.statusDate || ''}</span>
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: colors.dot }} />
                    </div>
                  </div>
                  {c.clientName && <p className="text-sm" style={{ color: '#1C3A6B' }}>{c.clientName}</p>}
                  <p className="text-sm font-medium mt-0.5" style={{ color: '#333' }}>{c.statusTitle}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs" style={{ color: '#8E8E93' }}>
                      {days !== null ? `Ultimo cambio: hace ${days} dias` : ''}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#8E8E93' }}>{c.formType}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default USCISTrackerPage;
