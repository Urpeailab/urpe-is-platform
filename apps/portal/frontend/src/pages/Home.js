import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Scale, FileText, Users, Award, ArrowRight, CheckCircle2, MessageCircle, Shield, Clock, Star, Search } from 'lucide-react';
import { Footer } from '../components/Footer';
import { LeadCaptureModal } from '../components/LeadCaptureModal';

export const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showLeadModal, setShowLeadModal] = useState(false);

  const services = [
    {
      icon: <Scale className="h-6 w-6 sm:h-8 sm:w-8" />,
      title: t('services.asylum.title'),
      description: t('services.asylum.desc'),
    },
    {
      icon: <Award className="h-6 w-6 sm:h-8 sm:w-8" />,
      title: t('services.eb2.title'),
      description: t('services.eb2.desc'),
    },
    {
      icon: <Users className="h-6 w-6 sm:h-8 sm:w-8" />,
      title: t('services.family.title'),
      description: t('services.family.desc'),
    },
    {
      icon: <FileText className="h-6 w-6 sm:h-8 sm:w-8" />,
      title: t('services.citizenship.title'),
      description: t('services.citizenship.desc'),
    },
  ];

  const features = [
    { icon: Shield, text: 'Expert legal guidance' },
    { icon: Clock, text: '24/7 AI-powered assistance' },
    { icon: FileText, text: 'Complete case management' },
    { icon: CheckCircle2, text: 'Transparent pricing' },
    { icon: Star, text: 'Document preparation' },
    { icon: Award, text: 'Status tracking' }
  ];

  const openWhatsApp = () => {
    window.open('https://wa.me/14705500109?text=%C2%A1Hola%2C%20quiero%20evaluar%20mi%20perfil!', '_blank');
  };

  return (
    <div className="min-h-screen bg-navy-primary">
      {/* Hero Section - Navy Premium */}
      <section className="relative min-h-[85vh] md:min-h-[90vh] flex items-center justify-center px-4 sm:px-6 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <img 
            src="/slider-1.webp" 
            alt="URPE Background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-primary/90 via-navy-primary/80 to-navy-primary"></div>
        </div>
        
        {/* Decorative gold line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gold-dark to-transparent"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10 py-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 mb-6 sm:mb-8">
            <span className="bg-gold-dark/20 text-gold-primary px-4 py-2 rounded-full text-xs sm:text-sm font-medium border border-gold-dark/30">
              Expertos en Inmigración desde 2010
            </span>
          </div>
          
          {/* Title - Serif font for premium feel */}
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold mb-4 sm:mb-6 leading-tight text-gold-subtle px-2">
            {t('hero.title')}
          </h1>
          
          {/* Decorative divider */}
          <div className="w-24 h-0.5 bg-gold-dark mx-auto mb-6 sm:mb-8"></div>
          
          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-light mb-8 sm:mb-10 max-w-2xl mx-auto px-4 font-light">
            {t('hero.subtitle')}
          </p>
          
          {/* CTA Button - Gold accent */}
          <div className="flex flex-col gap-4 justify-center items-center px-4">
            <Button
              onClick={() => setShowLeadModal(true)}
              size="lg"
              className="w-full sm:w-auto bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 rounded-lg shadow-gold hover:shadow-premium-lg transition-all duration-300 min-h-[56px] touch-manipulation"
              data-testid="hero-cta-button"
            >
              <Search className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              Verificar Elegibilidad
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            {/* Trust indicator */}
            <p className="text-xs sm:text-sm text-slate mt-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gold-dark" />
              Respuesta en menos de 5 minutos
            </p>
          </div>
        </div>
      </section>

      {/* Statistics Section - Navy Premium */}
      <section className="relative py-12 sm:py-16 md:py-24 px-4 sm:px-6 bg-navy-secondary overflow-hidden">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-gold-dark/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold-dark/5 rounded-full blur-3xl"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Header */}
          <div className="text-center mb-10 sm:mb-14 md:mb-16">
            <span className="inline-block bg-gold-dark/20 text-gold-primary px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider border border-gold-dark/30 mb-4">
              Resultados Comprobados
            </span>
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-gold-subtle">
              Nuestra <span className="text-gold-primary">Efectividad</span>
            </h2>
            <p className="text-sm sm:text-base text-slate max-w-2xl mx-auto px-4">
              Más de una década de excelencia respaldada por números reales
            </p>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Procesos Radicados */}
            <div className="bg-navy-primary border border-navy-light/20 rounded-xl p-6 sm:p-8 transition-all hover:border-gold-dark/30 hover:shadow-gold">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gold-dark/10 rounded-xl flex items-center justify-center mb-4 border border-gold-dark/20">
                  <FileText className="w-7 h-7 sm:w-8 sm:h-8 text-gold-primary" />
                </div>
                <div className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-gold-subtle mb-2">
                  13,140
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate uppercase tracking-wider mb-3">
                  Procesos Radicados
                </div>
                <div className="w-full h-1.5 bg-navy-light/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gold-primary rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
            </div>

            {/* Procesos Aprobados */}
            <div className="bg-navy-primary border border-navy-light/20 rounded-xl p-6 sm:p-8 transition-all hover:border-success/30 hover:shadow-premium">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-success/10 rounded-xl flex items-center justify-center mb-4 border border-success/20">
                  <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8 text-success" />
                </div>
                <div className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-gold-subtle mb-2">
                  12,312
                </div>
                <div className="text-xs sm:text-sm font-medium text-slate uppercase tracking-wider mb-3">
                  Procesos Aprobados
                </div>
                <div className="w-full h-1.5 bg-navy-light/30 rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
            </div>

            {/* Tasa de Aprobación */}
            <div className="sm:col-span-2 lg:col-span-1 bg-navy-primary border-2 border-gold-dark/30 rounded-xl p-6 sm:p-8 shadow-gold">
              <div className="flex flex-col items-center text-center">
                <span className="bg-gold-primary text-navy-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
                  ⭐ Líder en la Industria
                </span>
                <div className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-gold-primary mb-2">
                  93.7%
                </div>
                <div className="text-xs sm:text-sm font-medium text-gold-subtle uppercase tracking-wider mb-2">
                  Tasa de Aprobación
                </div>
                <p className="text-slate text-xs mb-4">
                  9 de cada 10 casos exitosos
                </p>
                {/* Circular progress */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r="45%" stroke="#334155" strokeWidth="6" fill="none" />
                    <circle cx="50%" cy="50%" r="45%" stroke="#C9A96A" strokeWidth="6" fill="none"
                      strokeDasharray="283" strokeDashoffset="22" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Award className="w-6 h-6 sm:w-8 sm:h-8 text-gold-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Stats Bar */}
          <div className="mt-8 sm:mt-12 bg-navy-primary/50 rounded-xl p-4 sm:p-6 border border-navy-light/20">
            <div className="flex justify-center text-center">
              <div>
                <div className="font-display text-xl sm:text-2xl font-semibold text-gold-primary mb-1">
                  Top 3%
                </div>
                <div className="text-xs sm:text-sm text-slate uppercase tracking-wide">en la Industria por tasa de éxito</div>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-6 text-center text-slate text-xs italic px-4">
            * Estadísticas verificadas y actualizadas mensualmente • Última actualización: Nov 2024
          </p>
        </div>
      </section>

      {/* Features Grid - Navy Premium */}
      <section className="py-10 sm:py-16 md:py-20 px-4 sm:px-6 bg-navy-primary">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index} 
                  className="flex items-center gap-3 p-4 rounded-lg bg-navy-secondary border border-navy-light/20 hover:border-gold-dark/30 transition-all touch-manipulation"
                  data-testid={`feature-${index}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gold-dark/10 flex items-center justify-center flex-shrink-0 border border-gold-dark/20">
                    <Icon className="h-5 w-5 text-gold-primary" />
                  </div>
                  <span className="text-sm font-medium text-gold-subtle">{feature.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services Section - Navy Premium */}
      <section id="services" className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-navy-secondary">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-gold-subtle mb-4 px-4">
              {t('services.title')}
            </h2>
            <div className="w-16 h-0.5 bg-gold-dark mx-auto"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {services.map((service, index) => (
              <Card
                key={index}
                className="bg-navy-primary border border-navy-light/20 hover:border-gold-dark/30 transition-all hover:shadow-gold cursor-pointer touch-manipulation"
                data-testid={`service-card-${index}`}
              >
                <CardHeader className="pb-2 sm:pb-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gold-dark/10 flex items-center justify-center mb-4 border border-gold-dark/20">
                    <div className="text-gold-primary">{service.icon}</div>
                  </div>
                  <CardTitle className="text-gold-subtle text-base sm:text-lg font-display font-medium">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-slate text-xs sm:text-sm">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Navy Premium */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 bg-navy-primary relative overflow-hidden">
        {/* Decorative border */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-dark/30 to-transparent"></div>
        
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold mb-4 text-gold-subtle px-4">
            ¿Listo para Comenzar tu Viaje?
          </h2>
          <p className="text-sm sm:text-base text-slate mb-8 px-4">
            Obtén tu evaluación de elegibilidad en minutos
          </p>
          <Button
            onClick={() => setShowLeadModal(true)}
            size="lg"
            className="w-full sm:w-auto bg-gold-primary hover:bg-gold-dark text-navy-primary font-semibold text-base sm:text-lg px-8 sm:px-12 py-6 rounded-lg shadow-gold hover:shadow-premium-lg transition-all min-h-[56px] touch-manipulation"
            data-testid="cta-eligibility-button"
          >
            <Search className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            Verificar Elegibilidad
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Lead Capture Modal */}
      <LeadCaptureModal 
        isOpen={showLeadModal} 
        onClose={() => setShowLeadModal(false)} 
      />
    </div>
  );
};
