import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { X, Save } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const LegalDocumentFormModal = ({ document, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: { en: '', es: '' },
    description: { en: '', es: '' },
    category: 'visa_types',
    subcategory: '',
    fileUrl: '',
    fileType: 'pdf',
    fileSize: 0,
    tags: [],
    language: 'both',
    isPremium: false
  });
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (document) {
      setFormData({
        title: document.title || { en: '', es: '' },
        description: document.description || { en: '', es: '' },
        category: document.category || 'visa_types',
        subcategory: document.subcategory || '',
        fileUrl: document.fileUrl || '',
        fileType: document.fileType || 'pdf',
        fileSize: document.fileSize || 0,
        tags: document.tags || [],
        language: document.language || 'both',
        isPremium: document.isPremium || false
      });
    }
  }, [document]);

  const categories = [
    { value: 'visa_types', label: 'Visa Types' },
    { value: 'forms', label: 'Forms & Templates' },
    { value: 'guides', label: 'Guides & Tutorials' },
    { value: 'regulations', label: 'Regulations & Laws' },
    { value: 'faqs', label: 'FAQs' }
  ];

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
    if (!formData.fileUrl.trim()) {
      toast.error('File URL is required');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const payload = { ...formData };

      if (document) {
        // Update existing
        await axios.put(`${API}/admin/legal-documents/${document._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Document updated successfully');
      } else {
        // Create new
        await axios.post(`${API}/admin/legal-documents`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Document created successfully');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to save document:', error);
      toast.error(error.response?.data?.detail || 'Failed to save document');
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {document ? 'Edit Document' : 'Upload New Document'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bilingual Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title (English) *</label>
                <input
                  type="text"
                  value={formData.title.en}
                  onChange={(e) => setFormData({ ...formData, title: { ...formData.title, en: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Form I-140 Guide"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title (Spanish) *</label>
                <input
                  type="text"
                  value={formData.title.es}
                  onChange={(e) => setFormData({ ...formData, title: { ...formData.title, es: e.target.value } })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Guía del Formulario I-140"
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
                  placeholder="Complete guide for filling out Form I-140..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Spanish) *</label>
                <textarea
                  value={formData.description.es}
                  onChange={(e) => setFormData({ ...formData, description: { ...formData.description, es: e.target.value } })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Guía completa para completar el Formulario I-140..."
                />
              </div>
            </div>

            {/* Category and Subcategory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subcategory</label>
                <input
                  type="text"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="EB-2 NIW"
                />
              </div>
            </div>

            {/* File URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">File URL *</label>
              <input
                type="url"
                value={formData.fileUrl}
                onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="https://example.com/documents/i-140-guide.pdf"
              />
              <p className="text-xs text-gray-400 mt-1">
                Upload your document to a cloud storage service and paste the public URL here
              </p>
            </div>

            {/* File Type and Size */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">File Type</label>
                <select
                  value={formData.fileType}
                  onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  <option value="pdf">PDF</option>
                  <option value="doc">DOC</option>
                  <option value="docx">DOCX</option>
                  <option value="xls">XLS</option>
                  <option value="xlsx">XLSX</option>
                  <option value="txt">TXT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">File Size (KB)</label>
                <input
                  type="number"
                  value={formData.fileSize}
                  onChange={(e) => setFormData({ ...formData, fileSize: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  min="0"
                  placeholder="1024"
                />
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Document Language</label>
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

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Add a tag and press Enter"
                />
                <Button type="button" onClick={addTag} className="bg-gray-700 hover:bg-gray-600">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} className="bg-blue-500/20 text-blue-500 px-3 py-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-blue-300"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Premium Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPremium"
                checked={formData.isPremium}
                onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
                className="mr-2 h-4 w-4 rounded border-gray-700 bg-gray-800 text-yellow-500 focus:ring-yellow-500"
              />
              <label htmlFor="isPremium" className="text-sm text-gray-300">
                Premium Content (Requires U2+ access)
              </label>
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
                {loading ? 'Saving...' : (document ? 'Update Document' : 'Upload Document')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
