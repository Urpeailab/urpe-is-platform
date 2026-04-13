import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { FileText, Book, Scale, BarChart3, Briefcase, Globe, Mail, UserCheck, Award } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';

const LandingPageSimple = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header-content">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Monica Logo" className="logo-image" />
            <h1 className="landing-logo">{t('landing.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Select value={i18n.language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate('/login')} data-testid="login-btn">
              {t('landing.login')}
            </Button>
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-content">
            <h2 className="hero-title">{t('landing.subtitle')}</h2>
            <p className="hero-description">
              {t('landing.description')}
            </p>
            <Button 
              size="lg" 
              className="hero-button"
              onClick={() => navigate('/register')}
              data-testid="get-started-btn"
            >
              {t('landing.getStarted')}
            </Button>
          </div>
        </section>

        <section className="features-section">
          <h3 className="features-title">{t('landing.features.title')}</h3>
          <p className="text-center text-lg mb-8 text-gray-600 font-semibold">{t('landing.features.subtitle')}</p>
          <div className="features-grid">
            <Card className="feature-card">
              <CardContent className="feature-content">
                <FileText size={48} className="feature-icon text-indigo-600" />
                <h4 className="feature-name">{t('landing.features.niw')}</h4>
                <p className="feature-desc">{t('landing.features.niw.desc')}</p>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardContent className="feature-content">
                <Scale size={48} className="feature-icon text-blue-600" />
                <h4 className="feature-name">{t('landing.features.patents')}</h4>
                <p className="feature-desc">{t('landing.features.patents.desc')}</p>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardContent className="feature-content">
                <Book size={48} className="feature-icon text-green-600" />
                <h4 className="feature-name">{t('landing.features.books')}</h4>
                <p className="feature-desc">{t('landing.features.books.desc')}</p>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardContent className="feature-content">
                <FileText size={48} className="feature-icon text-teal-600" />
                <h4 className="feature-name">{t('landing.features.whitepapers')}</h4>
                <p className="feature-desc">{t('landing.features.whitepapers.desc')}</p>
              </CardContent>
            </Card>

            <Card className="feature-card">
              <CardContent className="feature-content">
                <BarChart3 size={48} className="feature-icon text-orange-600" />
                <h4 className="feature-name">{t('landing.features.econometric')}</h4>
                <p className="feature-desc">{t('landing.features.econometric.desc')}</p>
              </CardContent>
            </Card>
          </div>

          <h3 className="features-title mt-12">{t('landing.comingsoon.title')}</h3>
          <div className="features-grid">
            <Card className="feature-card opacity-70">
              <CardContent className="feature-content">
                <Briefcase size={48} className="feature-icon text-amber-600" />
                <h4 className="feature-name">{t('landing.comingsoon.casestudies')}</h4>
                <p className="feature-desc">{t('landing.comingsoon.casestudies.desc')}</p>
                <span className="inline-block mt-3 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold">
                  {t('landing.comingsoon.title')}
                </span>
              </CardContent>
            </Card>

            <Card className="feature-card opacity-70">
              <CardContent className="feature-content">
                <Globe size={48} className="feature-icon text-purple-600" />
                <h4 className="feature-name">{t('landing.comingsoon.policy')}</h4>
                <p className="feature-desc">{t('landing.comingsoon.policy.desc')}</p>
                <span className="inline-block mt-3 px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                  {t('landing.comingsoon.title')}
                </span>
              </CardContent>
            </Card>

            <Card className="feature-card opacity-70">
              <CardContent className="feature-content">
                <Mail size={48} className="feature-icon text-cyan-600" />
                <h4 className="feature-name">{t('landing.comingsoon.selfpetition')}</h4>
                <p className="feature-desc">{t('landing.comingsoon.selfpetition.desc')}</p>
                <span className="inline-block mt-3 px-4 py-2 bg-cyan-100 text-cyan-800 rounded-full text-sm font-semibold">
                  {t('landing.comingsoon.title')}
                </span>
              </CardContent>
            </Card>

            <Card className="feature-card opacity-70">
              <CardContent className="feature-content">
                <UserCheck size={48} className="feature-icon text-pink-600" />
                <h4 className="feature-name">{t('landing.comingsoon.recommendation')}</h4>
                <p className="feature-desc">{t('landing.comingsoon.recommendation.desc')}</p>
                <span className="inline-block mt-3 px-4 py-2 bg-pink-100 text-pink-800 rounded-full text-sm font-semibold">
                  {t('landing.comingsoon.title')}
                </span>
              </CardContent>
            </Card>

            <Card className="feature-card opacity-70">
              <CardContent className="feature-content">
                <Award size={48} className="feature-icon text-violet-600" />
                <h4 className="feature-name">{t('landing.comingsoon.expert')}</h4>
                <p className="feature-desc">{t('landing.comingsoon.expert.desc')}</p>
                <span className="inline-block mt-3 px-4 py-2 bg-violet-100 text-violet-800 rounded-full text-sm font-semibold">
                  {t('landing.comingsoon.title')}
                </span>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© 2024 Monica - {t('landing.subtitle')}</p>
      </footer>
    </div>
  );
};

export default LandingPageSimple;
