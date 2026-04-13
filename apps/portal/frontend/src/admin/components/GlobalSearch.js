import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, FileText, Users, Video, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export const GlobalSearch = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async (searchQuery) => {
    setLoading(true);
    
    // Mock search results - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockResults = [
      {
        id: '1',
        type: 'user',
        title: 'John Smith',
        subtitle: 'john.smith@example.com',
        icon: Users,
        path: '/admin/users'
      },
      {
        id: '2',
        type: 'webinar',
        title: 'EB-2 NIW Workshop',
        subtitle: 'Upcoming webinar',
        icon: Video,
        path: '/admin/webinars'
      },
      {
        id: '3',
        type: 'document',
        title: 'Legal Guide 2024',
        subtitle: 'Legal Library',
        icon: FileText,
        path: '/admin/legal-library'
      },
      {
        id: '4',
        type: 'case',
        title: 'Software Engineer Case',
        subtitle: 'Comparator',
        icon: TrendingUp,
        path: '/admin/comparator'
      }
    ].filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setResults(mockResults);
    setLoading(false);
  };

  const handleResultClick = (path) => {
    navigate(path);
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-20">
      <div className="w-full max-w-2xl mx-4">
        {/* Search Input */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
          <div className="flex items-center px-4 py-3 border-b border-gray-800">
            <Search className="h-5 w-5 text-gray-400 mr-3" />
            <Input
              type="text"
              placeholder="Buscar usuarios, webinars, documentos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none focus:ring-0"
              autoFocus
            />
            {loading && <Loader2 className="h-5 w-5 text-gray-400 animate-spin mr-2" />}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => {
                const Icon = result.icon;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result.path)}
                    className="w-full flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="p-2 bg-yellow-500/10 rounded-lg mr-3">
                      <Icon className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{result.title}</p>
                      <p className="text-sm text-gray-400">{result.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center">
              <p className="text-gray-400">No se encontraron resultados</p>
            </div>
          )}

          {/* Tips */}
          {query.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              <p>Busca por nombre, email, título de webinar, documento...</p>
            </div>
          )}
        </div>

        {/* Close hint */}
        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            Presiona <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-300">ESC</kbd> para cerrar
          </p>
        </div>
      </div>
    </div>
  );
};
