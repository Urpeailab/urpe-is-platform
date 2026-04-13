import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const ComparatorCaseFormModal = ({ case: caseData, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    country: '',
    profession: '',
    visaType: 'EB-2 NIW',
    profile: {
      education: '',
      experience: 0,
      patents: 0,
      publications: 0,
      citations: 0,
      awards: 0
    },
    outcome: {
      status: 'approved',
      processingTime: 0,
      successRate: 100
    },
    timeline: []
  });

  useEffect(() => {
    if (caseData) {
      setFormData({
        country: caseData.country || '',
        profession: caseData.profession || '',
        visaType: caseData.visaType || 'EB-2 NIW',
        profile: caseData.profile || {
          education: '',
          experience: 0,
          patents: 0,
          publications: 0,
          citations: 0,
          awards: 0
        },
        outcome: caseData.outcome || {
          status: 'approved',
          processingTime: 0,
          successRate: 100
        },
        timeline: caseData.timeline || []
      });
    }
  }, [caseData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.country.trim()) {
      toast.error('Country is required');
      return;
    }
    if (!formData.profession.trim()) {
      toast.error('Profession is required');
      return;
    }
    if (!formData.profile.education.trim()) {
      toast.error('Education is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const payload = { ...formData };

      if (caseData) {
        // Update existing
        await axios.put(`${API}/admin/comparator-cases/${caseData._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Case updated successfully');
      } else {
        // Create new
        await axios.post(`${API}/admin/comparator-cases`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Case created successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save case:', error);
      toast.error(error.response?.data?.detail || 'Failed to save case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {caseData ? 'Edit Success Case' : 'Add New Success Case'}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Country *</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Colombia"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Profession *</label>
                  <input
                    type="text"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Visa Type</label>
                  <select
                    value={formData.visaType}
                    onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="EB-1A">EB-1A</option>
                    <option value="EB-2 NIW">EB-2 NIW</option>
                    <option value="O-1">O-1</option>
                    <option value="H-1B">H-1B</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Profile Details */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Profile Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Education *</label>
                  <input
                    type="text"
                    value={formData.profile.education}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      profile: { ...formData.profile, education: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="PhD in Computer Science"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Years of Experience</label>
                    <input
                      type="number"
                      value={formData.profile.experience}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        profile: { ...formData.profile, experience: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Patents</label>
                    <input
                      type="number"
                      value={formData.profile.patents}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        profile: { ...formData.profile, patents: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Publications</label>
                    <input
                      type="number"
                      value={formData.profile.publications}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        profile: { ...formData.profile, publications: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Citations</label>
                    <input
                      type="number"
                      value={formData.profile.citations}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        profile: { ...formData.profile, citations: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Awards</label>
                    <input
                      type="number"
                      value={formData.profile.awards}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        profile: { ...formData.profile, awards: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Outcome */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Outcome</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={formData.outcome.status}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      outcome: { ...formData.outcome, status: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="approved">Approved</option>
                    <option value="in_progress">In Progress</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Processing Time (months)</label>
                  <input
                    type="number"
                    value={formData.outcome.processingTime}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      outcome: { ...formData.outcome, processingTime: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Success Rate (%)</label>
                  <input
                    type="number"
                    value={formData.outcome.successRate}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      outcome: { ...formData.outcome, successRate: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="0"
                    max="100"
                  />
                </div>
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
                {loading ? 'Saving...' : (caseData ? 'Update Case' : 'Add Case')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
