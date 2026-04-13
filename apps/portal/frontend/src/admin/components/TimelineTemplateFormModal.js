import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const TimelineTemplateFormModal = ({ template, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    processType: 'filing',
    stages: [],
    prediction: {
      estimatedTotalMonths: 0,
      bestCaseMonths: 0,
      worstCaseMonths: 0,
      confidenceLevel: 95
    },
    factors: {
      positive: [],
      considerations: []
    }
  });
  const [positiveFactorInput, setPositiveFactorInput] = useState('');
  const [considerationInput, setConsiderationInput] = useState('');

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        description: template.description || '',
        processType: template.processType || 'filing',
        stages: template.stages || [],
        prediction: template.prediction || {
          estimatedTotalMonths: 0,
          bestCaseMonths: 0,
          worstCaseMonths: 0,
          confidenceLevel: 95
        },
        factors: template.factors || {
          positive: [],
          considerations: []
        }
      });
    }
  }, [template]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (formData.stages.length === 0) {
      toast.error('At least one stage is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const payload = { ...formData };

      if (template) {
        // Update existing
        await axios.put(`${API}/admin/timeline-templates/${template._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Template updated successfully');
      } else {
        // Create new
        await axios.post(`${API}/admin/timeline-templates`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Template created successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error(error.response?.data?.detail || 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const addStage = () => {
    const newStage = {
      id: Date.now(),
      name: '',
      duration: 1,
      durationUnit: 'months',
      description: '',
      status: 'pending'
    };
    setFormData({ ...formData, stages: [...formData.stages, newStage] });
  };

  const updateStage = (index, field, value) => {
    const updatedStages = [...formData.stages];
    updatedStages[index][field] = value;
    setFormData({ ...formData, stages: updatedStages });
  };

  const removeStage = (index) => {
    const updatedStages = formData.stages.filter((_, i) => i !== index);
    setFormData({ ...formData, stages: updatedStages });
  };

  const addPositiveFactor = () => {
    if (positiveFactorInput.trim() && !formData.factors.positive.includes(positiveFactorInput.trim())) {
      setFormData({ 
        ...formData, 
        factors: { 
          ...formData.factors, 
          positive: [...formData.factors.positive, positiveFactorInput.trim()] 
        }
      });
      setPositiveFactorInput('');
    }
  };

  const removePositiveFactor = (factor) => {
    setFormData({ 
      ...formData, 
      factors: { 
        ...formData.factors, 
        positive: formData.factors.positive.filter(f => f !== factor)
      }
    });
  };

  const addConsideration = () => {
    if (considerationInput.trim() && !formData.factors.considerations.includes(considerationInput.trim())) {
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

  const removeConsideration = (consideration) => {
    setFormData({ 
      ...formData, 
      factors: { 
        ...formData.factors, 
        considerations: formData.factors.considerations.filter(c => c !== consideration)
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-6xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {template ? 'Edit Timeline Template' : 'Create Timeline Template'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Basic Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Template Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder="Standard EB-2 NIW Filing Process"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Process Type</label>
                    <select
                      value={formData.processType}
                      onChange={(e) => setFormData({ ...formData, processType: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <option value="filing">Filing Process</option>
                      <option value="full_green_card">Full Green Card Process</option>
                      <option value="visa_application">Visa Application</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Describe this timeline template..."
                  />
                </div>
              </div>
            </div>

            {/* Stages */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Stages</h3>
                <Button type="button" onClick={addStage} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-black">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
              </div>
              <div className="space-y-3">
                {formData.stages.map((stage, index) => (
                  <Card key={stage.id || index} className="bg-gray-800 border-gray-700 p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-gray-400">Stage {index + 1}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeStage(index)}
                          className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <input
                            type="text"
                            value={stage.name}
                            onChange={(e) => updateStage(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="Stage name"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={stage.duration}
                            onChange={(e) => updateStage(index, 'duration', parseFloat(e.target.value) || 0)}
                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="Duration"
                            step="0.5"
                            min="0"
                          />
                          <select
                            value={stage.durationUnit}
                            onChange={(e) => updateStage(index, 'durationUnit', e.target.value)}
                            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                          </select>
                        </div>
                      </div>
                      <textarea
                        value={stage.description}
                        onChange={(e) => updateStage(index, 'description', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        placeholder="Stage description..."
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prediction */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Time Prediction</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Estimated (months)</label>
                  <input
                    type="number"
                    value={formData.prediction.estimatedTotalMonths}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      prediction: { ...formData.prediction, estimatedTotalMonths: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    step="0.5"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Best Case (months)</label>
                  <input
                    type="number"
                    value={formData.prediction.bestCaseMonths}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      prediction: { ...formData.prediction, bestCaseMonths: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    step="0.5"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Worst Case (months)</label>
                  <input
                    type="number"
                    value={formData.prediction.worstCaseMonths}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      prediction: { ...formData.prediction, worstCaseMonths: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    step="0.5"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confidence (%)</label>
                  <input
                    type="number"
                    value={formData.prediction.confidenceLevel}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      prediction: { ...formData.prediction, confidenceLevel: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>

            {/* Positive Factors */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Positive Factors</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={positiveFactorInput}
                  onChange={(e) => setPositiveFactorInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPositiveFactor())}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Add a positive factor"
                />
                <Button type="button" onClick={addPositiveFactor} className="bg-gray-700 hover:bg-gray-600">
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {formData.factors.positive.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-md">
                    <span className="text-white text-sm">{factor}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePositiveFactor(factor)}
                      className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Considerations */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Considerations</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={considerationInput}
                  onChange={(e) => setConsiderationInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addConsideration())}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Add a consideration"
                />
                <Button type="button" onClick={addConsideration} className="bg-gray-700 hover:bg-gray-600">
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {formData.factors.considerations.map((consideration, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-md">
                    <span className="text-white text-sm">{consideration}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeConsideration(consideration)}
                      className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                disabled={loading}
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
