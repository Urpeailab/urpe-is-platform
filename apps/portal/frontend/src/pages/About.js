import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, TrendingUp, Clock, Globe, Award, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';

export const About = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stats = [
    {
      icon: <Users className="h-8 w-8" />,
      value: '13,500+',
      label: t('about.stats.activeClients'),
    },
    {
      icon: <Globe className="h-8 w-8" />,
      value: '100,000+',
      label: t('about.stats.registeredUsers'),
    },
    {
      icon: <Clock className="h-8 w-8" />,
      value: '65%',
      label: t('about.stats.timeReduction'),
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      value: '$17.5M',
      label: t('about.stats.valuation'),
    },
  ];

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: t('about.features.ai.title'),
      description: t('about.features.ai.description'),
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: t('about.features.speed.title'),
      description: t('about.features.speed.description'),
    },
    {
      icon: <Award className="h-6 w-6" />,
      title: t('about.features.quality.title'),
      description: t('about.features.quality.description'),
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: t('about.features.expansion.title'),
      description: t('about.features.expansion.description'),
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="about-title">
              {t('about.hero.title')}
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-4xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('about.hero.subtitle')}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-black border-2 border-yellow-500/50 hover:border-yellow-500 transition-all" data-testid={`stat-card-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className="text-yellow-500 flex justify-center mb-3">
                    {stat.icon}
                  </div>
                  <p className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-400">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-4 bg-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-8 text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('about.story.title')}
          </h2>
          
          <div className="space-y-6 text-lg leading-relaxed text-gray-300" style={{ fontFamily: 'Inter, sans-serif' }}>
            <p data-testid="story-paragraph-1">
              {t('about.story.paragraph1')}
            </p>
            <p data-testid="story-paragraph-2">
              {t('about.story.paragraph2')}
            </p>
            <p data-testid="story-paragraph-3">
              {t('about.story.paragraph3')}
            </p>
            <p data-testid="story-paragraph-4">
              {t('about.story.paragraph4')}
            </p>
          </div>

          {/* Founder Highlight */}
          <div className="mt-12 p-8 bg-gradient-to-r from-yellow-500/10 to-transparent rounded-lg border border-yellow-500/30">
            <p className="text-xl text-gray-300 mb-4" data-testid="founder-info">
              {t('about.founder.text')}
            </p>
            <p className="text-sm text-gray-400">
              {t('about.founder.name')}
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold mb-12 text-center" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('about.whatMakesUsDifferent')}
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-black border-2 border-yellow-500/50 hover:border-yellow-500 transition-all" data-testid={`feature-card-${index}`}>
                <CardContent className="p-8">
                  <div className="flex items-start space-x-4">
                    <div className="text-yellow-500 mt-1">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {feature.title}
                      </h3>
                      <p className="text-gray-300">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-yellow-500/10 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <blockquote className="text-3xl sm:text-4xl font-bold mb-6" style={{ fontFamily: 'Manrope, sans-serif' }} data-testid="mission-quote">
            "{t('about.quote.text')}"
          </blockquote>
          <p className="text-gray-400 text-lg">
            {t('about.quote.attribution')}
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {t('about.cta.title')}
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            {t('about.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/eligibility')}
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg px-12 py-6 rounded-full"
              data-testid="cta-eligibility-button"
            >
              {t('about.cta.button')}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};
