import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Copy, RefreshCw, ExternalLink, Share2, Lock, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_COLORS = {
  approved: { bg: '#34C759', text: '#FFFFFF' },
  processing: { bg: '#007AFF', text: '#FFFFFF' },
  reviewing: { bg: '#007AFF', text: '#FFFFFF' },
  received: { bg: '#007AFF', text: '#FFFFFF' },
  rfe: { bg: '#FF9500', text: '#FFFFFF' },
  denied: { bg: '#FF3B30', text: '#FFFFFF' },
  unknown: { bg: '#8E8E93', text: '#FFFFFF' },
};

const FORM_NAMES = {
  'I-140': 'Immigrant Petition for Alien Workers',
  'I-129': 'Petition for Nonimmigrant Worker',
  'I-485': 'Application to Register Permanent Residence',
  'I-765': 'Application for Employment Authorization',
  'I-131': 'Application for Travel Document',
};

export const USCISCaseDetailPage = () => {
  const { receiptNumber } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const token = JSON.parse(localStorage.getItem('urpe_user') || '{}')?.token;

  const fetchCase = useCallback(async () => {
    if (!token || !receiptNumber) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/api/uscis/cases/${receiptNumber}`, { headers: { Authorization: `Bearer ${token}` } });
      setCaseData(data.case);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar el caso');
    } finally {
      setLoading(false);
    }
  }, [token, receiptNumber]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await axios.post(`${API}/api/uscis/cases/${receiptNumber}/refresh`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) {
        setCaseData(data.case);
        toast.success(data.statusChanged ? 'Estado actualizado!' : 'Sin cambios');
      } else {
        toast.error(data.error || 'Error al consultar USCIS');
      }
    } catch { toast.error('Error al actualizar'); }
    finally { setRefreshing(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptNumber);
    toast.success('Numero copiado');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#EEF1F5' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#1C3A6B' }} />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#EEF1F5' }}>
        <div className="text-center">
          <AlertCircle className="h-10 w-10 mx-auto mb-2" style={{ color: '#FF3B30' }} />
          <p style={{ color: '#1C3A6B' }}>Caso no encontrado</p>
          <Button onClick={() => navigate(-1)} className="mt-3" style={{ background: '#3D5A8A', color: '#fff' }}>Volver</Button>
        </div>
      </div>
    );
  }

  const colors = STATUS_COLORS[caseData.status] || STATUS_COLORS.unknown;
  const history = caseData.history || [];
  const hasMissingInfo = !caseData.serviceCenter || !caseData.countryOfOrigin;

  return (
    <div className="min-h-screen pb-24 sm:pb-8" style={{ background: '#EEF1F5' }}>
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard/uscis-tracker')}
          className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center">
          <ChevronRight className="h-5 w-5 rotate-180" style={{ color: '#1C3A6B' }} />
        </button>
        <button onClick={handleRefresh} disabled={refreshing}
          className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: '#1C3A6B' }} />
        </button>
      </div>

      <div className="px-4 sm:px-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4" style={{ color: '#1C3A6B' }}>USCIS Case</h1>

        {/* Case Info Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-lg" style={{ color: '#000' }}>{caseData.receiptNumber}</span>
            <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded">
              <Copy className="h-4 w-4" style={{ color: '#8E8E93' }} />
            </button>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EEF1F5', color: '#1C3A6B' }}>
              {caseData.formType} USCIS Case
            </span>
          </div>
          <p className="text-sm" style={{ color: '#8E8E93' }}>
            {FORM_NAMES[caseData.formType] || caseData.formType}
          </p>

          {hasMissingInfo && (
            <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg" style={{ background: '#FFF8E7' }}>
              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: '#FF9500' }} />
              <span className="text-xs flex-1" style={{ color: '#8B7355' }}>
                Service Center and Country of Origin Required
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#3D5A8A', color: '#fff' }}>
                Add details
              </span>
            </div>
          )}
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
          <p className="text-xs mb-2" style={{ color: '#8E8E93' }}>
            Case updated: {caseData.statusDate || 'N/A'}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-5 rounded" style={{ background: colors.bg }} />
            <span className="font-bold" style={{ color: '#000' }}>{caseData.statusTitle}</span>
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: '#333' }}>
            {caseData.statusDescription}
          </p>
          <div style={{ borderTop: '1px solid #C6C6C8' }} className="pt-3">
            <a href={`https://egov.uscis.gov/casestatus/mycasestatus.do`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#007AFF' }}>
              <ExternalLink className="h-4 w-4" />
              View Online
            </a>
          </div>
        </div>

        {/* History */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg" style={{ color: '#1C3A6B' }}>History</h2>
          </div>
          {history.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <Clock className="h-8 w-8 mx-auto mb-2" style={{ color: '#C6C6C8' }} />
              <p className="text-sm" style={{ color: '#8E8E93' }}>No history yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="relative pl-6">
                {history.map((entry, i) => {
                  const entryColor = STATUS_COLORS[entry.status] || STATUS_COLORS.unknown;
                  return (
                    <div key={i} className="relative pb-4 last:pb-0">
                      {/* Dot */}
                      <div className="absolute left-[-18px] top-1 h-3 w-3 rounded-full" style={{ background: entryColor.bg }} />
                      {/* Line */}
                      {i < history.length - 1 && (
                        <div className="absolute left-[-13px] top-4 bottom-0 w-px" style={{ background: '#C6C6C8' }} />
                      )}
                      <p className="text-xs font-medium" style={{ color: '#8E8E93' }}>{entry.date}</p>
                      <p className="text-sm" style={{ color: '#333' }}>{entry.description || entry.statusTitle}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Estimated Processing Time — Coming Soon */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-lg" style={{ color: '#1C3A6B' }}>Estimated processing time</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#E5E5EA', color: '#8E8E93' }}>
              Coming soon
            </span>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm text-center relative overflow-hidden" style={{ background: '#E5E5EA' }}>
            <div className="absolute inset-0 backdrop-blur-sm bg-white/70 flex flex-col items-center justify-center z-10">
              <Lock className="h-6 w-6 mb-2" style={{ color: '#8E8E93' }} />
              <p className="text-sm font-medium" style={{ color: '#8E8E93' }}>Proximamente</p>
            </div>
            <div className="h-4 w-3/4 mx-auto rounded mb-2" style={{ background: '#C6C6C8' }} />
            <div className="h-4 w-1/2 mx-auto rounded" style={{ background: '#C6C6C8' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default USCISCaseDetailPage;
