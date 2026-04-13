import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Mail, Phone, Globe, Award, Star } from 'lucide-react';

export const AdvisorProfile = () => {
  const { t } = useTranslation();

  const advisor = {
    name: 'Gigliola Bocanegra',
    title: t('advisor.title'),
    photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gigliola&backgroundColor=ffc700',
    email: 'gigliola@urpe.com',
    phone: '+1 (555) 000-0000',
    languages: ['English', 'Español'],
    specialties: [
      t('advisor.specialty1'),
      t('advisor.specialty2'),
      t('advisor.specialty3'),
    ],
    experience: t('advisor.experience'),
    cases: '13,500+',
    rating: 4.9,
  };

  return (
    <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-2 border-yellow-500" data-testid="advisor-profile">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Photo & Basic Info */}
          <div className="flex flex-col items-center md:items-start space-y-3">
            <div className="relative">
              <img
                src={advisor.photo}
                alt={advisor.name}
                className="h-32 w-32 rounded-full border-4 border-yellow-500 bg-yellow-500/20"
              />
              <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-success border-4 border-black flex items-center justify-center">
                <Award className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {advisor.name}
              </h3>
              <p className="text-sm text-yellow-500 font-semibold">
                {advisor.title}
              </p>
              <div className="flex items-center justify-center md:justify-start space-x-1 mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.floor(advisor.rating)
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
                <span className="text-sm text-gray-300 ml-2">{advisor.rating}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4">
            {/* Contact */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 text-sm">
                <Mail className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-gray-300">{advisor.email}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Phone className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-gray-300">{advisor.phone}</span>
              </div>
            </div>

            {/* Languages */}
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-yellow-500" />
              <div className="flex gap-2">
                {advisor.languages.map((lang) => (
                  <Badge key={lang} className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-500">{advisor.cases}</p>
                <p className="text-xs text-gray-400">{t('advisor.clientsHelped')}</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-500">{advisor.experience}</p>
                <p className="text-xs text-gray-400">{t('advisor.yearsExp')}</p>
              </div>
            </div>

            {/* Specialties */}
            <div>
              <p className="text-sm font-semibold text-gray-400 mb-2">{t('advisor.specialties')}:</p>
              <div className="flex flex-wrap gap-2">
                {advisor.specialties.map((specialty, idx) => (
                  <Badge key={idx} className="bg-white/10 text-white border-white/20">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-6 pt-6 border-t border-yellow-500/20">
          <p className="text-sm text-gray-300 leading-relaxed">
            {t('advisor.bio')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
