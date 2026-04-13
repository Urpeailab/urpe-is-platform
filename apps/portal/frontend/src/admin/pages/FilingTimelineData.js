import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Calendar, Clock, TrendingUp, AlertCircle, CheckCircle2, Circle, Play, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { TimelineDataEditModal } from '../components/TimelineDataEditModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const USER_ID = 'user-001'; // Default user for demo

export const FilingTimelineData = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchTimelinePrediction();
  }, []);

  const fetchTimelinePrediction = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/timeline/${USER_ID}`);
      if (!response.ok) throw new Error('Failed a fetch timeline');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      toast.error('Failed a load timeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = () => {
    fetchTimelinePrediction();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-success" />;
      case 'in_progress':
        return <Play className="h-6 w-6 text-blue-500 animate-pulse" />;
      default:
        return <Circle className="h-6 w-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'in_progress':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timeline data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Filing Timeline - URPE Process
          </h1>
          <p className="text-gray-600 mt-2">Detailed breakdown de the EB-2 NIW filing timeline and services</p>
        </div>
        <Button 
          onClick={() => setShowEditModal(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-black"
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit Timeline
        </Button>
      </div>

      {/* Prediction Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Estimated Total</p>
                <p className="text-3xl font-bold text-gray-900">{data?.prediction.estimatedTotalMonths}</p>
                <p className="text-sm text-gray-800 mt-1">months</p>
              </div>
              <Calendar className="h-12 w-12 text-gray-900 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-success">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Best Case</p>
                <p className="text-3xl font-bold text-success">{data?.prediction.bestCaseMonths}</p>
                <p className="text-sm text-gray-600 mt-1">months</p>
              </div>
              <TrendingUp className="h-12 w-12 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Worst Case</p>
                <p className="text-3xl font-bold text-orange-500">{data?.prediction.worstCaseMonths}</p>
                <p className="text-sm text-gray-600 mt-1">months</p>
              </div>
              <Clock className="h-12 w-12 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Confidence</p>
                <p className="text-3xl font-bold text-purple-500">{data?.prediction.confidenceLevel}%</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estimated Arrival Banner */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Estimated Filing Date
              </h3>
              <p className="text-3xl font-bold text-yellow-400">
                {formatDate(data?.prediction.estimatedFilingDate)}
              </p>
              <p className="text-sm mt-2 text-blue-100">
                Based on current processing times and service execution
              </p>
            </div>
            <Calendar className="h-20 w-20 text-gray-900 opacity-80" />
          </div>
        </CardContent>
      </Card>

      {/* Timeline Stages */}
      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle className="text-gray-900 text-xl">Timeline Stages</CardTitle>
          <CardDescription className="text-gray-600">
            Detailed breakdown de the filing process stages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6 bg-white min-h-screen">
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
                  <div className="flex-grow bg-gray-50 rounded-lg p-4 border-l-4 border-yellow-500 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-bold text-gray-900">
                        {stage.name}
                      </h4>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        stage.status === 'completed' ? 'bg-success/20 text-success' :
                        stage.status === 'in_progress' ? 'bg-blue-500/20 text-blue-500' :
                        'bg-gray-700 text-gray-600'
                      }`}>
                        {stage.status === 'completed' ? 'Completado' :
                         stage.status === 'in_progress' ? 'In Progress' :
                         'Pendiente'}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-3">
                      {stage.description}
                    </p>

                    {/* Show 15 Services Breakdown for Stage 1 */}
                    {stage.id === 1 && stage.services && (
                      <div className="mb-4 bg-white rounded-lg p-4 border-2 border-yellow-500/30">
                        <h5 className="text-md font-bold text-gray-900 mb-3 flex items-center">
                          <span className="bg-yellow-500 text-black px-2 py-1 rounded mr-2 text-sm">{stage.services.length} Servicios</span>
                          Desglose del Paquete de Documentación
                        </h5>
                        <div className="space-y-3">
                          {/* Group services by category */}
                          {['Required Forms', 'Technical Evidence', 'Business Documentation', 'Professional Presence', 'Letters Package'].map((category) => {
                            const categoryServices = stage.services.filter(s => s.category === category);
                            if (categoryServices.length === 0) return null;
                            
                            return (
                              <div key={category} className="border-l-2 border-yellow-500/50 pl-3">
                                <p className="text-xs font-semibold text-yellow-500 mb-2">{category}</p>
                                <div className="space-y-1">
                                  {categoryServices.map((service) => (
                                    <div key={service.id} className="flex items-center justify-between text-xs">
                                      <div className="flex items-center flex-1">
                                        <span className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center text-[10px] mr-2">✓</span>
                                        <span className="text-gray-700">{service.name}</span>
                                      </div>
                                      <span className="text-gray-500 font-medium ml-2 whitespace-nowrap">
                                        {service.duration} {service.unit === 'days' ? (service.duration === 1 ? 'day' : 'days') : 'months'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {stage.services.find(s => s.note) && (
                          <p className="text-xs text-gray-500 mt-3 italic border-t border-gray-700 pt-2">
                            * {stage.services.find(s => s.note).note}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 font-medium">Duration:</span>
                        <span className="ml-2 text-gray-900 font-semibold">
                          {stage.duration} {stage.durationUnit === 'day' ? (stage.duration === 1 ? 'day' : 'days') : 'months'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">Start Date:</span>
                        <span className="ml-2 text-gray-900 font-semibold">{formatDate(stage.startDate)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">End Date:</span>
                        <span className="ml-2 text-gray-900 font-semibold">{formatDate(stage.endDate)}</span>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="mt-3 flex items-center space-x-4">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-700 rounded-full h-2 mr-2" style={{ width: '100px' }}>
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${stage.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          Confidence: {stage.confidence}%
                        </span>
                      </div>
                      {stage.probability && (
                        <span className="text-xs text-orange-500 font-semibold">
                          Probability: {stage.probability}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Factors Affecting Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positive Factors */}
        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-success">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <CheckCircle2 className="h-6 w-6 mr-2 text-success" />
              Positive Factors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.factors.positive.map((factor, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-success mr-2">✓</span>
                  <span className="text-gray-700 text-sm">{factor}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Considerations */}
        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center">
              <AlertCircle className="h-6 w-6 mr-2 text-yellow-500" />
              Considerations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.factors.considerations.map((consideration, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-yellow-500 mr-2">!</span>
                  <span className="text-gray-700 text-sm">{consideration}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Disclaimer */}
      <Card className="bg-blue-500/10 border-blue-500/30 border">
        <CardContent className="p-4">
          <p className="text-sm text-blue-300">
            <strong>Important Note:</strong> These timelines are estimates based on current USCIS processing times and typical service execution. Actual times may vary depending on case complexity, USCIS workload, and individual circumstances.
          </p>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {showEditModal && (
        <TimelineDataEditModal
          data={data}
          userId={USER_ID}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
};
