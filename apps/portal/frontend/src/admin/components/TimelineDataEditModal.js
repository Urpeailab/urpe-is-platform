import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TimelineDataEditModal = ({ data, userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    prediction: {
      estimatedTotalMonths: 0,
      bestCaseMonths: 0,
      worstCaseMonths: 0,
      confidenceLevel: 0,
      estimatedFilingDate: ''
    },
    stages: [],
    factors: {
      positive: [],
      considerations: []
    }
  });
  const [positiveInput, setPositiveInput] = useState('');
  const [considerationInput, setConsiderationInput] = useState('');

  useEffect(() => {
    if (data) {
      setFormData({
        prediction: data.prediction || {
          estimatedTotalMonths: 0,
          bestCaseMonths: 0,
          worstCaseMonths: 0,
          confidenceLevel: 0,
          estimatedFilingDate: ''
        },
        stages: data.stages || [],
        factors: data.factors || { positive: [], considerations: [] }
      });
    }
  }, [data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      await axios.put(`${API}/admin/timeline-data/${userId}`, {
        userId,
        ...formData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Timeline data updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update timeline:', error);
      toast.error(error.response?.data?.detail || 'Failed to update timeline');
    } finally {
      setLoading(false);
    }
  };

  const updateStage = (index, field, value) => {
    const updatedStages = [...formData.stages];
    updatedStages[index][field] = value;
    setFormData({ ...formData, stages: updatedStages });
  };

  const addPositiveFactor = () => {
    if (positiveInput.trim()) {
      setFormData({
        ...formData,
        factors: {
          ...formData.factors,
          positive: [...formData.factors.positive, positiveInput.trim()]
        }
      });
      setPositiveInput('');
    }
  };

  const removePositiveFactor = (index) => {
    const updated = formData.factors.positive.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      factors: { ...formData.factors, positive: updated }
    });
  };

  const addConsideration = () => {
    if (considerationInput.trim()) {
      setFormData({
        ...formData,
        factors: {
          ...formData.factors,
          considerations: [...formData.factors.considerations, considerationInput.trim()]
        }
      });
      setConsiderationInput('');
    }
  };

  const removeConsideration = (index) => {
    const updated = formData.factors.considerations.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      factors: { ...formData.factors, considerations: updated }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Timeline Data - {userId}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Prediction Section */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Prediction</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Estimated (months)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.prediction.estimatedTotalMonths}
                    onChange={(e) => setFormData({
                      ...formData,
                      prediction: { ...formData.prediction, estimatedTotalMonths: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Best Case (months)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.prediction.bestCaseMonths}
                    onChange={(e) => setFormData({
                      ...formData,
                      prediction: { ...formData.prediction, bestCaseMonths: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-success"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Worst Case (months)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.prediction.worstCaseMonths}
                    onChange={(e) => setFormData({
                      ...formData,
                      prediction: { ...formData.prediction, worstCaseMonths: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confidence (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.prediction.confidenceLevel}
                    onChange={(e) => setFormData({
                      ...formData,
                      prediction: { ...formData.prediction, confidenceLevel: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Estimated Filing Date</label>
                <input
                  type="date"
                  value={formData.prediction.estimatedFilingDate.split('T')[0]}
                  onChange={(e) => setFormData({
                    ...formData,
                    prediction: { ...formData.prediction, estimatedFilingDate: e.target.value }
                  })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Stages Section */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Stages</h3>
              <div className="space-y-4">
                {formData.stages.map((stage, index) => (
                  <Card key={stage.id || index} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-400">Stage {index + 1}</span>
                          <select
                            value={stage.status}
                            onChange={(e) => updateStage(index, 'status', e.target.value)}
                            className="px-3 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={stage.name}
                          onChange={(e) => updateStage(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                          placeholder="Stage name"
                        />
                        <textarea
                          value={stage.description}
                          onChange={(e) => updateStage(index, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                          placeholder="Stage description"
                        />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <input
                            type="number"
                            step="0.1"
                            value={stage.duration}
                            onChange={(e) => updateStage(index, 'duration', parseFloat(e.target.value))}
                            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                            placeholder="Duration"
                          />
                          <select
                            value={stage.durationUnit}
                            onChange={(e) => updateStage(index, 'durationUnit', e.target.value)}
                            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                          </select>
                          <input
                            type="date"
                            value={stage.startDate}
                            onChange={(e) => updateStage(index, 'startDate', e.target.value)}
                            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                          />
                          <input
                            type="date"
                            value={stage.endDate}
                            onChange={(e) => updateStage(index, 'endDate', e.target.value)}
                            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Factors Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Positive Factors */}
              <div>
                <h3 className="text-lg font-bold text-success mb-3">Positive Factors</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={positiveInput}
                    onChange={(e) => setPositiveInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPositiveFactor())}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    placeholder="Add positive factor"
                  />
                  <Button type="button" onClick={addPositiveFactor} size="sm" className="bg-success hover:bg-success">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.factors.positive.map((factor, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded">
                      <span className="text-white text-sm flex-1">{factor}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePositiveFactor(index)}
                        className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Considerations */}
              <div>
                <h3 className="text-lg font-bold text-yellow-500 mb-3">Considerations</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={considerationInput}
                    onChange={(e) => setConsiderationInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addConsideration())}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    placeholder="Add consideration"
                  />
                  <Button type="button" onClick={addConsideration} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.factors.considerations.map((consideration, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded">
                      <span className="text-white text-sm flex-1">{consideration}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeConsideration(index)}
                        className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                disabled={loading}
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
