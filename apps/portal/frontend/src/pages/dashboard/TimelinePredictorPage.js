import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Clock, TrendingUp, AlertCircle, CheckCircle2, Circle, Play } from 'lucide-react';

const TimelinePredictorPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchTimelinePrediction();
  }, [user]);

  const fetchTimelinePrediction = async () => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${BACKEND_URL}/api/timeline/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch timeline');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-success" />;
      case 'in_progress':
        return <Play className="h-6 w-6 text-gold-primary animate-pulse" />;
      default:
        return <Circle className="h-6 w-6 text-slate" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'in_progress':
        return 'bg-gold-primary';
      default:
        return 'bg-gray-600';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffc700] mx-auto"></div>
          <p className="mt-4 text-slate">{t('timeline.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-navy-secondary">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gold-subtle mb-2 flex items-center gap-3">
          <Clock className="h-8 w-8 text-gold-primary" />
          {t('timeline.title')}
        </h1>
        <p className="text-slate">
          {t('timeline.subtitle')}
        </p>
      </div>

      {/* Prediction Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-yellow-500/30 to-white border-2 border-gold-dark rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate mb-1">{t('timeline.prediction.estimated')}</p>
              <p className="text-3xl font-bold text-gold-primary">{data?.prediction.estimatedTotalMonths}</p>
              <p className="text-sm text-slate mt-1">{t('timeline.months')}</p>
            </div>
            <Calendar className="h-12 w-12 text-gold-primary" />
          </div>
        </div>

        <div className="bg-navy-secondary border-2 border-success/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate mb-1">{t('timeline.prediction.bestCase')}</p>
              <p className="text-3xl font-bold text-success">{data?.prediction.bestCaseMonths}</p>
              <p className="text-sm text-slate mt-1">{t('timeline.months')}</p>
            </div>
            <TrendingUp className="h-12 w-12 text-success" />
          </div>
        </div>

        <div className="bg-navy-secondary border-2 border-gold-dark/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate mb-1">{t('timeline.prediction.worstCase')}</p>
              <p className="text-3xl font-bold text-gold-primary">{data?.prediction.worstCaseMonths}</p>
              <p className="text-sm text-slate mt-1">{t('timeline.months')}</p>
            </div>
            <Clock className="h-12 w-12 text-gold-primary" />
          </div>
        </div>

        <div className="bg-navy-secondary border-2 border-success/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate mb-1">{t('timeline.prediction.confidence')}</p>
              <p className="text-3xl font-bold text-success">{data?.prediction.confidenceLevel}%</p>
            </div>
            <CheckCircle2 className="h-12 w-12 text-success" />
          </div>
        </div>
      </div>

      {/* Estimated Arrival Banner */}
      <div className="bg-gradient-to-r from-yellow-500/20 to-white border-2 border-gold-dark rounded-lg p-6 mb-8 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gold-subtle mb-2">
              {t('timeline.arrivalBanner.title')}
            </h3>
            <p className="text-3xl font-bold text-gold-primary">
              {formatDate(data?.prediction.estimatedFilingDate)}
            </p>
            <p className="text-sm mt-2 text-slate">
              {t('timeline.arrivalBanner.subtitle')}
            </p>
          </div>
          <Calendar className="h-20 w-20 text-gold-primary" />
        </div>
      </div>

      {/* Timeline Stages */}
      <div className="bg-navy-secondary border-2 border-navy-light/30 rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-xl font-bold text-gold-subtle mb-6">
          {t('timeline.stages.title')}
        </h3>
        
        <div className="space-y-6">
          {data?.stages.map((stage, index) => (
            <div key={stage.id} className="relative">
              {/* Connector Line */}
              {index < data.stages.length - 1 && (
                <div className={`absolute left-3 top-12 w-0.5 h-full ${getStatusColor(stage.status)}`}></div>
              )}
              
              <div className="flex items-start">
                {/* Status Icon */}
                <div className="flex-shrink-0 mr-4">
                  {getStatusIcon(stage.status)}
                </div>

                {/* Stage Content */}
                <div className="flex-grow bg-navy-secondary border-2 border-navy-light/30 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-gold-subtle">
                      {t(`timeline.stages.stage${stage.id}.name`, stage.name)}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      stage.status === 'completed' ? 'bg-success/20 text-success border-success/30' :
                      stage.status === 'in_progress' ? 'bg-gold-primary/20 text-gold-dark border-gold-dark/30' :
                      'bg-navy-light/30 text-slate border-navy-light/30'
                    }`}>
                      {stage.status === 'completed' ? t('timeline.stages.completed') :
                       stage.status === 'in_progress' ? t('timeline.stages.inProgress') :
                       t('timeline.stages.pending')}
                    </span>
                  </div>

                  <p className="text-slate text-sm mb-3">
                    {t(`timeline.stages.stage${stage.id}.description`, stage.description)}
                  </p>

                  {/* Show 17 Services Breakdown for Stage 1 */}
                  {stage.id === 1 && stage.services && (
                    <div className="mb-4 bg-gray-900 border-2 border-gold-dark/50 rounded-lg p-4">
                      <h5 className="text-md font-bold text-white mb-3 flex items-center">
                        <span className="bg-gold-primary text-black px-2 py-1 rounded mr-2 text-sm">{stage.services.length} Servicios</span>
                        Desglose del Paquete de Documentación
                      </h5>
                      <div className="space-y-3">
                        {/* Group services by category */}
                        {['Required Forms', 'Technical Evidence', 'Business Documentation', 'Professional Presence', 'Letters Package'].map((category) => {
                          const categoryServices = stage.services.filter(s => s.category === category);
                          if (categoryServices.length === 0) return null;
                          
                          return (
                            <div key={category} className="border-l-2 border-gold-dark/50 pl-3">
                              <p className="text-xs font-semibold text-gold-primary mb-2">{category}</p>
                              <div className="space-y-1">
                                {categoryServices.map((service) => (
                                  <div key={service.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center flex-1">
                                      <span className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center text-[10px] mr-2 border border-success/30">✓</span>
                                      <span className="text-slate">{t(`timeline.services.${service.id}.name`, service.name)}</span>
                                    </div>
                                    <span className="text-slate-light font-medium ml-2 whitespace-nowrap">
                                      {service.duration} {(service.unit === 'days' || service.unit === 'day') ? (service.duration === 1 ? 'día' : 'días') : 'meses'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {stage.services.find(s => s.note) && (
                        <p className="text-xs text-slate-light mt-3 italic border-t border-gray-700 pt-2">
                          * {stage.services.find(s => s.note).note}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate font-medium">{t('timeline.stages.duration')}:</span>
                      <span className="ml-2 text-gold-subtle font-semibold">
                        {stage.duration} {
                          stage.durationUnit === 'day' 
                            ? (stage.duration === 1 ? 'día' : 'días')
                            : (stage.duration === 1 ? t('timeline.month') : t('timeline.months'))
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-slate font-medium">{t('timeline.stages.startDate')}:</span>
                      <span className="ml-2 text-gold-subtle font-semibold">{formatDate(stage.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate font-medium">{t('timeline.stages.endDate')}:</span>
                      <span className="ml-2 text-gold-subtle font-semibold">{formatDate(stage.endDate)}</span>
                    </div>
                  </div>

                  {/* Confidence & Probability */}
                  <div className="mt-3 flex items-center space-x-4">
                    <div className="flex items-center">
                      <div className="w-full bg-navy-light/30 rounded-full h-2 mr-2" style={{ width: '100px' }}>
                        <div 
                          className="bg-success h-2 rounded-full" 
                          style={{ width: `${stage.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-slate">
                        {t('timeline.stages.confidence')}: {stage.confidence}%
                      </span>
                    </div>
                    {stage.probability && (
                      <span className="text-xs text-gold-primary font-semibold">
                        {t('timeline.stages.probability')}: {stage.probability}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Factors Affecting Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positive Factors */}
        <div className="bg-green-50 rounded-lg shadow-md p-6 border-l-4 border-success">
          <h3 className="text-lg font-bold text-gold-subtle mb-4 flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2 text-success" />
            {t('timeline.factors.positive.title')}
          </h3>
          <ul className="space-y-2">
            {data?.factors.positive.map((factor, index) => (
              <li key={index} className="flex items-start">
                <span className="text-success mr-2">✓</span>
                <span className="text-slate text-sm">
                  {t(`timeline.factors.positive.factor${index + 1}`, factor)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Considerations */}
        <div className="bg-gold-dark/10 rounded-lg shadow-md p-6 border-l-4 border-gold-dark">
          <h3 className="text-lg font-bold text-gold-subtle mb-4 flex items-center">
            <AlertCircle className="h-6 w-6 mr-2 text-gold-dark" />
            {t('timeline.factors.considerations.title')}
          </h3>
          <ul className="space-y-2">
            {data?.factors.considerations.map((consideration, index) => (
              <li key={index} className="flex items-start">
                <span className="text-gold-dark mr-2">!</span>
                <span className="text-slate text-sm">
                  {t(`timeline.factors.considerations.factor${index + 1}`, consideration)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>{t('timeline.disclaimer.title')}:</strong> {t('timeline.disclaimer.text')}
        </p>
      </div>
    </div>
  );
};

export default TimelinePredictorPage;
