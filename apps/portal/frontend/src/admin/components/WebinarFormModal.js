import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const WebinarFormModal = ({ webinar, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: { en: '', es: '' },
    description: { en: '', es: '' },
    type: 'upcoming',
    date: '',
    time: '',
    duration: 60,
    capacity: 100,
    videoUrl: '',
    thumbnail: '',
    presenter: { name: '', title: '', avatar: '' },
    level: 'intermediate',
    topics: [],
    language: 'both'
  });
  const [topicInput, setTopicInput] = useState('');

  useEffect(() => {
    if (webinar) {
      setFormData({
        title: webinar.title || { en: '', es: '' },
        description: webinar.description || { en: '', es: '' },
        type: webinar.type || 'upcoming',
        date: webinar.date ? webinar.date.split('T')[0] : '',
        time: webinar.time || '',
        duration: webinar.duration || 60,
        capacity: webinar.capacity || 100,
        videoUrl: webinar.videoUrl || webinar.meetingLink || '',
        thumbnail: webinar.thumbnail || '',
        presenter: webinar.presenter || { name: '', title: '', avatar: '' },
        level: webinar.level || 'intermediate',
        topics: webinar.topics || [],
        language: webinar.language || 'both'
      });
    }
  }, [webinar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.title.en.trim() || !formData.title.es.trim()) {
      toast.error('Title is required in both languages');
      return;
    }
    if (!formData.description.en.trim() || !formData.description.es.trim()) {
      toast.error('Description is required in both languages');
      return;
    }
    if (formData.type === 'upcoming' && !formData.date) {
      toast.error('Date is required for upcoming webinars');
      return;
    }
    if (formData.type === 'recorded' && !formData.videoUrl) {
      toast.error('Video URL is required for recorded webinars');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const payload = { ...formData };
      
      // Format date for backend
      if (payload.date) {
        payload.date = `${payload.date}T00:00:00`;
      }

      if (webinar) {
        // Update existing
        await axios.put(`${API}/admin/webinars/${webinar._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Webinar updated successfully');
      } else {
        // Create new
        await axios.post(`${API}/admin/webinars`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Webinar created successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save webinar:', error);
      toast.error(error.response?.data?.detail || 'Failed to save webinar');
    } finally {
      setLoading(false);
    }
  };

  const addTopic = () => {
    if (topicInput.trim() && !formData.topics.includes(topicInput.trim())) {
      setFormData({ ...formData, topics: [...formData.topics, topicInput.trim()] });
      setTopicInput('');
    }
  };

  const removeTopic = (topic) => {
    setFormData({ ...formData, topics: formData.topics.filter(t => t !== topic) });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-2xl my-8 max-h-[90vh] flex flex-col">
        <CardHeader className="border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {webinar ? 'Edit Webinar' : 'Create New Webinar'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Webinar Type *</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="upcoming"
                    checked={formData.type === 'upcoming'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mr-2"
                  />
                  <span className="text-white">Upcoming Event</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="recorded"
                    checked={formData.type === 'recorded'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mr-2"
                  />
                  <span className="text-white">Recorded Session</span>
                </label>
              </div>
            </div>

            {/* Bilingual Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title (English) *</label>
                <input
                  type="text"
                  value={formData.title.en}
                  onChange={(e) => setFormData({ ...formData, title: { ...formData.title, en: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Understanding EB-2 NIW Process"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title (Spanish) *</label>
                <input
                  type="text"
                  value={formData.title.es}
                  onChange={(e) => setFormData({ ...formData, title: { ...formData.title, es: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Entendiendo el Proceso EB-2 NIW"
                />
              </div>
            </div>

            {/* Bilingual Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (English) *</label>
                <textarea
                  value={formData.description.en}
                  onChange={(e) => setFormData({ ...formData, description: { ...formData.description, en: e.target.value } })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Learn about the key requirements and benefits..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Spanish) *</label>
                <textarea
                  value={formData.description.es}
                  onChange={(e) => setFormData({ ...formData, description: { ...formData.description, es: e.target.value } })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Aprende sobre los requisitos clave y beneficios..."
                />
              </div>
            </div>

            {/* Date/Time for Upcoming */}
            {formData.type === 'upcoming' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Duration (min)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="15"
                    step="15"
                  />
                </div>
              </div>
            )}

            {/* Capacity and Video URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.type === 'upcoming' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Capacity</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    min="1"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {formData.type === 'upcoming' ? 'Meeting Link' : 'Video URL *'}
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="https://zoom.us/j/... or https://youtube.com/..."
                />
              </div>
            </div>

            {/* Thumbnail */}
            {formData.type === 'recorded' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Thumbnail URL</label>
                <input
                  type="url"
                  value={formData.thumbnail}
                  onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="https://example.com/thumbnail.jpg"
                />
              </div>
            )}

            {/* Presenter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Presenter Name</label>
                <input
                  type="text"
                  value={formData.presenter.name}
                  onChange={(e) => setFormData({ ...formData, presenter: { ...formData.presenter, name: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Gigliola Bocanegra"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Presenter Title</label>
                <input
                  type="text"
                  value={formData.presenter.title}
                  onChange={(e) => setFormData({ ...formData, presenter: { ...formData.presenter, title: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Immigration Attorney"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Presenter Avatar URL</label>
                <input
                  type="url"
                  value={formData.presenter.avatar}
                  onChange={(e) => setFormData({ ...formData, presenter: { ...formData.presenter, avatar: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>

            {/* Level and Language */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="both">Both (EN & ES)</option>
                  <option value="en">English Only</option>
                  <option value="es">Spanish Only</option>
                </select>
              </div>
            </div>

            {/* Topics */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Topics</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Add a topic and press Enter"
                />
                <Button type="button" onClick={addTopic} className="bg-gray-700 hover:bg-gray-600">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.topics.map((topic, index) => (
                  <Badge key={index} className="bg-yellow-500/20 text-yellow-500 px-3 py-1">
                    {topic}
                    <button
                      type="button"
                      onClick={() => removeTopic(topic)}
                      className="ml-2 hover:text-yellow-300"
                    >
                      ×
                    </button>
                  </Badge>
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
                {loading ? 'Saving...' : (webinar ? 'Update Webinar' : 'Create Webinar')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
