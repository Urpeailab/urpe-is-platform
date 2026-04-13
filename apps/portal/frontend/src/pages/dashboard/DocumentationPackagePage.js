import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { 
  CheckCircle2, 
  FileText, 
  Lightbulb, 
  Building2, 
  Palette,
  Mail,
  Clock,
  AlertCircle,
  Calendar,
  ArrowRight
} from 'lucide-react';

export const DocumentationPackagePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);

  const serviceCategories = [
    {
      id: 'forms',
      title: t('package.categories.forms'),
      icon: FileText,
      color: 'blue',
      services: [
        { 
          id: 'forms',
          name: t('package.services.forms'), 
          duration: 2, 
          unit: 'days',
          why: t('package.why.forms')
        }
      ]
    },
    {
      id: 'technical',
      title: t('package.categories.technical'),
      icon: Lightbulb,
      color: 'purple',
      services: [
        { 
          id: 'patent',
          name: t('package.services.patent'), 
          duration: 5, 
          unit: 'days',
          why: t('package.why.patent')
        },
        { 
          id: 'bookWriting',
          name: t('package.services.bookWriting'), 
          duration: 10, 
          unit: 'days',
          why: t('package.why.book')
        },
        { 
          id: 'bookPublishing',
          name: t('package.services.bookPublishing'), 
          duration: 5, 
          unit: 'days',
          why: t('package.why.book')
        },
        { 
          id: 'articles',
          name: t('package.services.articles'), 
          duration: 60, 
          unit: 'days',
          why: t('package.why.articles')
        },
        { 
          id: 'whitePaper',
          name: t('package.services.whitePaper'), 
          duration: 3, 
          unit: 'days',
          why: t('package.why.whitePaper')
        }
      ]
    },
    {
      id: 'business',
      title: t('package.categories.business'),
      icon: Building2,
      color: 'green',
      services: [
        { 
          id: 'businessPlan',
          name: t('package.services.businessPlan'), 
          duration: 5, 
          unit: 'days',
          why: t('package.why.businessPlan')
        },
        { 
          id: 'econometric',
          name: t('package.services.econometric'), 
          duration: 5, 
          unit: 'days',
          why: t('package.why.econometric')
        },
        { 
          id: 'impactReport',
          name: t('package.services.impactReport'), 
          duration: 3, 
          unit: 'days',
          why: t('package.why.impactReport')
        },
        { 
          id: 'caseStudies',
          name: t('package.services.caseStudies'), 
          duration: 2, 
          unit: 'days',
          why: t('package.why.caseStudies')
        }
      ]
    },
    {
      id: 'presence',
      title: t('package.categories.presence'),
      icon: Palette,
      color: 'orange',
      services: [
        { 
          id: 'website',
          name: t('package.services.website'), 
          duration: 5, 
          unit: 'days',
          why: t('package.why.website')
        },
        { 
          id: 'app',
          name: t('package.services.app'), 
          duration: 15, 
          unit: 'days',
          why: t('package.why.app'),
          note: t('package.services.appNote')
        },
        { 
          id: 'logo',
          name: t('package.services.logo'), 
          duration: 1, 
          unit: 'day',
          why: t('package.why.logo')
        },
        { 
          id: 'pressKit',
          name: t('package.services.pressKit'), 
          duration: 1, 
          unit: 'day',
          why: t('package.why.pressKit')
        }
      ]
    },
    {
      id: 'letters',
      title: t('package.categories.letters'),
      icon: Mail,
      color: 'yellow',
      services: [
        { 
          id: 'letters',
          name: t('package.services.letters'), 
          duration: 5, 
          unit: 'days', 
          note: t('package.services.lettersNote'),
          why: t('package.why.letters')
        }
      ]
    }
  ];

  const totalServices = serviceCategories.reduce((acc, cat) => acc + cat.services.length, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-navy-secondary">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#ffc700] to-[#ffed4e] rounded-2xl p-8 mb-8 shadow-xl">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-black/10 rounded-lg p-3">
              <FileText className="h-8 w-8 text-gold-subtle" />
            </div>
            <h1 className="text-4xl font-bold text-gold-subtle">
              {t('package.hero.title')}
            </h1>
          </div>
          <p className="text-xl text-gold-subtle mb-6">
            {t('package.hero.subtitle')}
          </p>
          <div className="flex items-center gap-6 text-gold-subtle">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">{totalServices} {t('package.hero.services')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">75 {t('package.hero.days')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">{t('package.hero.departments')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Important Disclaimer */}
      <Card className="mb-8 border-2 border-orange-500 bg-orange-500/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-lg text-orange-600 mb-2">
                {t('package.disclaimer.title')}
              </h3>
              <p className="text-slate leading-relaxed">
                {t('package.disclaimer.text')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services by Category - Premium Design */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gold-subtle mb-8">
          {t('package.services.title')}
        </h2>
        <div className="space-y-8">
          {serviceCategories.map((category, catIdx) => (
            <div key={category.id} className="relative group">
              {/* Gradient Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 via-transparent to-yellow-400/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <Card className="relative bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-gold-dark/80/30 hover:border-gold-dark/80 transition-all duration-500 overflow-hidden">
                {/* Decorative corner gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-400/10 to-transparent rounded-full blur-3xl"></div>
                
                <CardContent className="p-8 relative">
                  {/* Category Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl blur-md opacity-50"></div>
                      <div className="relative h-16 w-16 rounded-xl bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 flex items-center justify-center shadow-lg">
                        <category.icon className="h-8 w-8 text-black" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">{category.title}</h3>
                      <p className="text-gold-primary text-sm font-semibold">{category.services.length} {t('package.services.servicesCount')}</p>
                    </div>
                  </div>

                  {/* Services List */}
                  <div className="space-y-3">
                    {category.services.map((service, idx) => (
                      <div 
                        key={idx} 
                        className="group/item relative overflow-hidden rounded-xl bg-navy-secondary/5 hover:bg-navy-secondary/10 border border-white/10 hover:border-gold-dark/80/50 p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/20"
                        onClick={() => setSelectedService(service)}
                      >
                        {/* Hover gradient effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/0 via-yellow-400/5 to-yellow-400/0 opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                        
                        <div className="relative flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Check icon with gradient */}
                            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-success to-success flex items-center justify-center shadow-md">
                              <CheckCircle2 className="h-6 w-6 text-white" />
                            </div>
                            
                            <div className="flex-1">
                              <p className="text-white font-semibold text-base mb-1 group-hover/item:text-gold-primary transition-colors">{service.name}</p>
                              {service.note && (
                                <p className="text-xs text-slate-light italic mb-2">{service.note}</p>
                              )}
                              <div className="flex items-center gap-2 text-gold-primary text-sm font-medium opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <span>{t('package.clickToLearn')}</span>
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </div>
                          </div>

                          {/* Duration Badge */}
                          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-400/20 to-yellow-600/20 border border-gold-dark/80/30">
                            <Clock className="h-4 w-4 text-gold-primary" />
                            <span className="text-white font-semibold text-sm">{service.duration} {service.unit === 'day' ? t('package.day') : t('package.days')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Value Proposition */}
      <Card className="mb-8 bg-gradient-to-r from-gray-900 to-gray-800 border-2 border-[#ffc700]">
        <CardContent className="p-8">
          <h3 className="text-2xl font-bold text-white mb-4">
            {t('package.value.title')}
          </h3>
          <p className="text-slate text-lg mb-6">
            {t('package.value.description')}
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-navy-secondary/10 rounded-lg p-4">
              <CheckCircle2 className="h-6 w-6 text-[#ffc700] mb-2" />
              <p className="text-white font-semibold">{t('package.value.benefit1')}</p>
            </div>
            <div className="bg-navy-secondary/10 rounded-lg p-4">
              <CheckCircle2 className="h-6 w-6 text-[#ffc700] mb-2" />
              <p className="text-white font-semibold">{t('package.value.benefit2')}</p>
            </div>
            <div className="bg-navy-secondary/10 rounded-lg p-4">
              <CheckCircle2 className="h-6 w-6 text-[#ffc700] mb-2" />
              <p className="text-white font-semibold">{t('package.value.benefit3')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          onClick={() => navigate('/dashboard/appointments')}
          className="bg-[#ffc700] text-black hover:bg-[#ffed4e] text-lg py-6 px-8 font-bold"
          size="lg"
        >
          {t('package.cta.start')}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button
          onClick={() => navigate('/dashboard/appointments')}
          variant="outline"
          className="border-2 border-[#ffc700] text-[#ffc700] hover:bg-[#ffc700] hover:text-black text-lg py-6 px-8 font-bold"
          size="lg"
        >
          <Calendar className="mr-2 h-5 w-5" />
          {t('package.cta.schedule')}
        </Button>
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedService(null)}
        >
          <div 
            className="bg-navy-secondary rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-[#ffc700] to-[#ffed4e] p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gold-subtle">{selectedService.name}</h3>
                <button
                  onClick={() => setSelectedService(null)}
                  className="h-8 w-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors"
                >
                  <span className="text-2xl text-gold-subtle">×</span>
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3 text-gold-subtle">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">
                    {selectedService.duration} {selectedService.unit === 'day' ? t('package.day') : t('package.days')}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gold-subtle mb-3 flex items-center">
                  <Lightbulb className="h-5 w-5 mr-2 text-[#ffc700]" />
                  {t('package.whyTitle')}
                </h4>
                <p className="text-slate leading-relaxed text-base">
                  {selectedService.why}
                </p>
              </div>

              {selectedService.note && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>{t('package.note')}:</strong> {selectedService.note}
                  </p>
                </div>
              )}

              <Button
                onClick={() => navigate('/dashboard/appointments')}
                className="w-full bg-[#ffc700] text-black hover:bg-[#ffed4e] font-bold py-3"
              >
                {t('package.modal.schedule')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentationPackagePage;
