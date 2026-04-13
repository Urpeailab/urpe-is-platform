import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Calendar, Clock, TrendingUp, CheckCircle2, Circle, Play, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TimelineOverview = () => {
  const [usersTimelines, setUsersTimelines] = useState([]);
  const [stats, setStats] = useState({
    averageEstimated: 0,
    averageBest: 0,
    averageWorst: 0,
    totalUsers: 0,
    usersInProgress: 0
  });
  const [loading, setLoading] = useState(true);
  const [ seleccionadoUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchAllTimelines();
  }, []);

  const fetchAllTimelines = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      // Fetch all users first
      const { data: usersData } = await axios.get(`${API}/admin/users`, {
        params: { limit: 100 },
        headers: { Authorization: `Bearer ${token}` }
      });

      // Fetch timeline for each user
      const timelinesPromises = usersData.users.map(async (user) => {
        try {
          const response = await axios.get(`${API}/timeline/${user._id}`);
          return {
            user,
            timeline: response.data
          };
        } catch (error) {
          console.error(`Failed a fetch timeline for user ${user._id}:`, error);
          return null;
        }
      });

      const timelines = (await Promise.all(timelinesPromises)).filter(t => t !== null);
      setUsersTimelines(timelines);

      // Calculate statistics
      if (timelines.length > 0) {
        const avgEstimated = timelines.reduce((sum, t) => sum + (t.timeline.prediction.estimatedTotalMonths || 0), 0) / timelines.length;
        const avgBest = timelines.reduce((sum, t) => sum + (t.timeline.prediction.bestCaseMonths || 0), 0) / timelines.length;
        const avgWorst = timelines.reduce((sum, t) => sum + (t.timeline.prediction.worstCaseMonths || 0), 0) / timelines.length;
        const inProgress = timelines.filter(t => t.timeline.stages?.some(s => s.status === 'in_progress')).length;

        setStats({
          averageEstimated: avgEstimated.toFixed(1),
          averageBest: avgBest.toFixed(1),
          averageWorst: avgWorst.toFixed(1),
          totalUsers: timelines.length,
          usersInProgress: inProgress
        });
      }
    } catch (error) {
      console.error('Failed a load timelines:', error);
      toast.error('Failed a load timeline data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'in_progress':
        return <Play className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <Circle className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600 text-xl">Loading timeline data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Filing Timeline - URPE Process
        </h1>
        <p className="text-gray-600 mt-2">Overview de all users' filing timelines and predictions</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Avg. Estimated</p>
                <p className="text-3xl font-bold text-gray-900">{stats.averageEstimated}</p>
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
                <p className="text-sm text-gray-600 mb-1">Avg. Best Case</p>
                <p className="text-3xl font-bold text-success">{stats.averageBest}</p>
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
                <p className="text-sm text-gray-600 mb-1">Avg. Worst Case</p>
                <p className="text-3xl font-bold text-orange-500">{stats.averageWorst}</p>
                <p className="text-sm text-gray-600 mt-1">months</p>
              </div>
              <Clock className="h-12 w-12 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-blue-500">{stats.totalUsers}</p>
                <p className="text-sm text-gray-600 mt-1">tracked</p>
              </div>
              <Users className="h-12 w-12 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-2 border-gray-200 shadow-md border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-purple-500">{stats.usersInProgress}</p>
                <p className="text-sm text-gray-600 mt-1">users</p>
              </div>
              <Play className="h-12 w-12 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Timeline List */}
      <Card className="bg-white border-2 border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle className="text-gray-900">Users Timeline Details</CardTitle>
        </CardHeader>
        <CardContent>
          {usersTimelines.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-600" />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">No timeline data available</h3>
              <p className="mt-2 text-sm text-gray-600">
                Timeline predictions will appear here once users complete their eligibility check
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {usersTimelines.map(({ user, timeline }) => (
                <div
                  key={user._id}
                  className="bg-gray-50 rounded-lg p-6 hover:bg-gray-100 transition-all cursor-pointer border border-gray-200"
                  onClick={() => setSelectedUser( seleccionadoUser?._id === user._id ? null : { user, timeline })}
                >
                  {/* User Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-yellow-500 flex items-center justify-center text-gray-900 font-bold text-lg">
                        {user.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{user.name || 'User'}</h4>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Estimated Filing Date</p>
                      <p className="text-lg font-bold text-yellow-500">
                        {formatDate(timeline.prediction?.estimatedFilingDate)}
                      </p>
                    </div>
                  </div>

                  {/* Prediction Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Estimado</p>
                      <p className="text-2xl font-bold text-gray-900">{timeline.prediction?.estimatedTotalMonths || 0}</p>
                      <p className="text-xs text-gray-600">meses</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Mejor Caso</p>
                      <p className="text-2xl font-bold text-success">{timeline.prediction?.bestCaseMonths || 0}</p>
                      <p className="text-xs text-gray-600">meses</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Peor Caso</p>
                      <p className="text-2xl font-bold text-orange-500">{timeline.prediction?.worstCaseMonths || 0}</p>
                      <p className="text-xs text-gray-600">meses</p>
                    </div>
                  </div>

                  {/* Stages Summary */}
                  <div className="flex items-center space-x-2">
                    {timeline.stages?.map((stage, index) => (
                      <div key={stage.id || index} className="flex items-center">
                        {getStatusIcon(stage.status)}
                        {index < timeline.stages.length - 1 && (
                          <div className="w-8 h-0.5 bg-gray-700 mx-1"></div>
                        )}
                      </div>
                    ))}
                    <span className="text-sm text-gray-600 ml-2">
                      {timeline.stages?.filter(s => s.status === 'completed').length || 0} / {timeline.stages?.length || 0} completed
                    </span>
                  </div>

                  {/* Expanded Details */}
                  { seleccionadoUser?._id === user._id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h5 className="text-md font-bold text-gray-900 mb-4">Etapas del Cronograma</h5>
                      <div className="space-y-4">
                        {timeline.stages?.map((stage, index) => (
                          <div key={stage.id || index} className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(stage.status)}
                                <h6 className="text-sm font-bold text-gray-900">{stage.name}</h6>
                              </div>
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
                            <p className="text-xs text-gray-600 mb-2">{stage.description}</p>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500">Duration:</span>
                                <span className="ml-1 text-gray-900 font-semibold">
                                  {stage.duration} {stage.durationUnit === 'day' ? (stage.duration === 1 ? 'day' : 'days') : 'months'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Start:</span>
                                <span className="ml-1 text-gray-900">{formatDate(stage.startDate)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">End:</span>
                                <span className="ml-1 text-gray-900">{formatDate(stage.endDate)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Factors */}
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div>
                          <h6 className="text-sm font-bold text-success mb-2 flex items-center">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Positive Factors
                          </h6>
                          <ul className="space-y-1">
                            {timeline.factors?.positive?.map((factor, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start">
                                <span className="text-success mr-1">✓</span>
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h6 className="text-sm font-bold text-yellow-500 mb-2 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            Considerations
                          </h6>
                          <ul className="space-y-1">
                            {timeline.factors?.considerations?.map((consideration, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start">
                                <span className="text-yellow-500 mr-1">!</span>
                                {consideration}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
