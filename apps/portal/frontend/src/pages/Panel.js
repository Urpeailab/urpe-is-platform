import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { FileText, Calendar, DollarSign, MessageSquare, Upload, Eye } from 'lucide-react';
import { EligibilityReport } from '../components/EligibilityReport';
import { getDisplayName } from '../utils/userUtils';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const Panel = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Set language from user preference if available
    if (user.language && i18n.language !== user.language) {
      i18n.changeLanguage(user.language);
    }

    // Fetch user's case data
    const fetchCaseData = async () => {
      try {
        const response = await axios.get(`${API}/cases/user/${user.id}`);
        setCaseData(response.data);
      } catch (error) {
        console.error('Error fetching case data:', error);
        // Mock data for demo
        setCaseData({
          id: '123',
          type: 'EB-2 NIW',
          stage: 'Document Review',
          progress: 45,
          nextSteps: [
            'Upload employment verification letters',
            'Schedule consultation call',
          ],
          documents: {
            pending: 3,
            completed: 7,
          },
          appointments: [
            {
              id: '1',
              date: '2025-02-15',
              time: '10:00 AM',
              type: 'Initial Consultation',
            },
          ],
          payments: {
            due: 500,
            total: 2000,
            paid: 1500,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCaseData();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 pb-16 px-4 flex items-center justify-center">
        <p className="text-xl">{t('common.loading')}</p>
      </div>
    );
  }

  // Check if user has eligibility report
  const hasEligibilityReport = user?.report;

  return (
    <div className="min-h-screen bg-black text-white pt-28 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="dashboard-welcome">
            {t('dashboard.welcome')}, {getDisplayName(user)}!
          </h1>
          <p className="text-gray-400">
            {hasEligibilityReport 
              ? 'Review your personalized eligibility report and track your progress'
              : 'Track your immigration case progress and manage documents'
            }
          </p>
        </div>

        {/* Eligibility Report Section */}
        {hasEligibilityReport && (
          <div className="mb-12">
            <EligibilityReport report={user.report} />
          </div>
        )}

        {/* Case Overview - Only show if not showing eligibility report */}
        {!hasEligibilityReport && (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-black border-2 border-yellow-500/50 md:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="case-title">
                    {t('dashboard.case.title')}
                  </CardTitle>
                  <CardDescription className="text-gray-300 mt-1">
                    {caseData?.type}
                  </CardDescription>
                </div>
                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500" data-testid="case-stage">
                  {caseData?.stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">{t('dashboard.case.stage')}</span>
                  <span className="text-white font-medium">{caseData?.progress}%</span>
                </div>
                <Progress value={caseData?.progress} className="h-2" data-testid="case-progress" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">{t('dashboard.case.nextSteps')}</h3>
                <ul className="space-y-2">
                  {caseData?.nextSteps?.map((step, index) => (
                    <li key={index} className="flex items-start space-x-2" data-testid={`next-step-${index}`}>
                      <span className="text-yellow-500 mt-1">•</span>
                      <span className="text-gray-300">{step}</span>
                    </li>
                  )) || []}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-4">
            <Card className="bg-black border-2 border-yellow-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-400">{t('dashboard.documents.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-bold text-white" data-testid="docs-completed">{caseData?.documents.completed}</p>
                    <p className="text-sm text-gray-400">{t('dashboard.documents.completed')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-500" data-testid="docs-pending">{caseData?.documents.pending}</p>
                    <p className="text-sm text-gray-400">{t('dashboard.documents.pending')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black border-2 border-yellow-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-400">{t('dashboard.payments.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white mb-1" data-testid="payment-due">${caseData?.payments.due}</p>
                <p className="text-sm text-gray-400 mb-3">{t('dashboard.payments.due')}</p>
                <Button
                  onClick={() => navigate('/payments')}
                  size="sm"
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                  data-testid="pay-now-button"
                >
                  {t('dashboard.payments.pay')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        )}

        {/* Appointments - Only show if not showing eligibility report */}
        {!hasEligibilityReport && (
        <Card className="bg-black border-2 border-yellow-500/50 mb-8">
          <CardHeader>
            <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t('dashboard.appointments.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caseData?.appointments && caseData.appointments.length > 0 ? (
              <div className="space-y-3">
                {caseData.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-yellow-500/20"
                    data-testid={`appointment-${apt.id}`}
                  >
                    <div className="flex items-center space-x-4">
                      <Calendar className="h-8 w-8 text-yellow-500" />
                      <div>
                        <p className="font-semibold">{apt.type}</p>
                        <p className="text-sm text-gray-400">
                          {apt.date} at {apt.time}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10">
                      {t('common.view')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8" data-testid="no-appointments">
                {t('dashboard.appointments.none')}
              </p>
            )}
          </CardContent>
        </Card>
        )}

        {/* Quick Actions - Only show if not showing eligibility report */}
        {!hasEligibilityReport && (
        <div>
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('dashboard.quickActions')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              onClick={() => navigate('/documents')}
              variant="outline"
              className="h-24 border-2 border-yellow-500/50 hover:border-yellow-500 hover:bg-yellow-500/10 flex flex-col items-center justify-center space-y-2"
              data-testid="action-upload-docs"
            >
              <Upload className="h-8 w-8 text-yellow-500" />
              <span className="text-white">{t('dashboard.action.uploadDoc')}</span>
            </Button>

            <Button
              onClick={() => navigate('/appointments')}
              variant="outline"
              className="h-24 border-2 border-yellow-500/50 hover:border-yellow-500 hover:bg-yellow-500/10 flex flex-col items-center justify-center space-y-2"
              data-testid="action-schedule"
            >
              <Calendar className="h-8 w-8 text-yellow-500" />
              <span className="text-white">{t('dashboard.action.schedule')}</span>
            </Button>

            <Button
              onClick={() => navigate('/messages')}
              variant="outline"
              className="h-24 border-2 border-yellow-500/50 hover:border-yellow-500 hover:bg-yellow-500/10 flex flex-col items-center justify-center space-y-2"
              data-testid="action-chat-monica"
            >
              <MessageSquare className="h-8 w-8 text-yellow-500" />
              <span className="text-white">{t('dashboard.action.chatMonica')}</span>
            </Button>

            <Button
              onClick={() => navigate(`/case/${caseData?.id}`)}
              variant="outline"
              className="h-24 border-2 border-yellow-500/50 hover:border-yellow-500 hover:bg-yellow-500/10 flex flex-col items-center justify-center space-y-2"
              data-testid="action-view-case"
            >
              <Eye className="h-8 w-8 text-yellow-500" />
              <span className="text-white">{t('dashboard.action.viewCase')}</span>
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
