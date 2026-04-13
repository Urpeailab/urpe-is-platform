import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Users, TrendingUp, Clock, Award, FileText, CheckCircle, Filter } from 'lucide-react';

const ComparatorPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    fetchSimilarCases();
  }, [user]);

  const fetchSimilarCases = async () => {
    try {
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
      const response = await fetch(`${BACKEND_URL}/api/comparator/${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch similar cases');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching similar cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCases = () => {
    if (!data) return [];
    let filtered = data.similarCases;
    
    if (selectedCountry !== 'all') {
      filtered = filtered.filter(c => c.country === selectedCountry);
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(c => c.status === selectedStatus);
    }
    
    return filtered;
  };

  const getUniqueCountries = () => {
    if (!data) return [];
    return [...new Set(data.similarCases.map(c => c.country))];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffc700] mx-auto"></div>
          <p className="mt-4 text-gray-700">{t('comparator.loading')}</p>
        </div>
      </div>
    );
  }

  const filteredCases = getFilteredCases();
  const countries = getUniqueCountries();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-white">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Users className="h-8 w-8 text-yellow-500" />
          {t('comparator.title')}
        </h1>
        <p className="text-gray-700">
          {t('comparator.subtitle')}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border-2 border-yellow-500/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('comparator.stats.similarCases')}</p>
              <p className="text-3xl font-bold text-gray-900">{data?.statistics.totalSimilarCases}</p>
            </div>
            <Users className="h-12 w-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white border-2 border-success/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('comparator.stats.avgSuccess')}</p>
              <p className="text-3xl font-bold text-success">{data?.statistics.averageSuccessRate}%</p>
            </div>
            <TrendingUp className="h-12 w-12 text-success" />
          </div>
        </div>

        <div className="bg-white border-2 border-yellow-500/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('comparator.stats.avgTime')}</p>
              <p className="text-3xl font-bold text-yellow-500">{data?.statistics.averageProcessingTime} {t('comparator.months')}</p>
            </div>
            <Clock className="h-12 w-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white border-2 border-success/50 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{t('comparator.stats.yourMatch')}</p>
              <p className="text-3xl font-bold text-success">{data?.statistics.yourMatchScore}%</p>
            </div>
            <Award className="h-12 w-12 text-success" />
          </div>
        </div>
      </div>

      {/* Profile Strength Banner */}
      <div className="bg-gradient-to-r from-yellow-500/20 to-white border-2 border-yellow-500 rounded-lg p-6 mb-8 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t('comparator.profileStrength.title')}: {data?.statistics.profileStrength}
            </h3>
            <p className="text-gray-700">
              {t('comparator.profileStrength.description')}
            </p>
          </div>
          <CheckCircle className="h-16 w-16 text-success" />
        </div>
      </div>

      {/* Common Success Factors */}
      <div className="bg-white border-2 border-success/50 rounded-lg shadow-lg p-6 mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <FileText className="h-6 w-6 mr-2 text-success" />
          {t('comparator.commonFactors.title')}
        </h3>
        <ul className="space-y-2">
          {data?.statistics.commonFactors.map((factor, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle className="h-5 w-5 text-success mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700">{t(`comparator.commonFactors.factor${index + 1}`, factor)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Filters */}
      <div className="bg-white border-2 border-yellow-500/50 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 mr-2 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900">{t('comparator.filters.title')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('comparator.filters.country')}
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="all">{t('comparator.filters.allCountries')}</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('comparator.filters.status')}
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="all">{t('comparator.filters.allStatuses')}</option>
              <option value="Approved">{t('comparator.filters.approved')}</option>
              <option value="In Progress">{t('comparator.filters.inProgress')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Similar Cases Grid */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {t('comparator.cases.title')} ({filteredCases.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCases.map((case_) => (
            <div key={case_.id} className="bg-white border-2 border-gray-300 rounded-lg hover:border-yellow-500/60 transition-all duration-300 shadow-md">
              <div className={`h-2 rounded-t-lg ${case_.status === 'Approved' ? 'bg-success' : 'bg-yellow-500'}`}></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-900">{case_.profession}</h4>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    case_.status === 'Approved' 
                      ? 'bg-success/20 text-success border border-success/30' 
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {case_.status === 'Approved' ? t('comparator.cases.approved') : t('comparator.cases.inProgress')}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-700">
                    <span className="font-medium mr-2">{t('comparator.cases.country')}:</span>
                    <span>{case_.country}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-300">
                    <span className="font-medium mr-2">{t('comparator.cases.visa')}:</span>
                    <span>{case_.visaType}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-300">
                    <span className="font-medium mr-2">{t('comparator.cases.education')}:</span>
                    <span>{case_.education}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-300">
                    <span className="font-medium mr-2">{t('comparator.cases.experience')}:</span>
                    <span>{case_.experience} {t('comparator.years')}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('comparator.cases.successRate')}:</span>
                    <span className="text-lg font-bold text-success">{case_.successRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('comparator.cases.processingTime')}:</span>
                    <span className="text-lg font-bold text-yellow-500">{case_.processingTime} {t('comparator.months')}</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">{t('comparator.cases.profile')}:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('comparator.cases.patents')}:</span>
                      <span className="font-semibold text-gray-900">{case_.profile.patents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('comparator.cases.publications')}:</span>
                      <span className="font-semibold text-white">{case_.profile.publications}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('comparator.cases.citations')}:</span>
                      <span className="font-semibold text-white">{case_.profile.citations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('comparator.cases.awards')}:</span>
                      <span className="font-semibold text-white">{case_.profile.awards}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComparatorPage;
