import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { FileText, Book, Scale, BarChart3, Briefcase, Globe, Mail, UserCheck, Award, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  return (
    <div className="landing-page" style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      color: '#111827',
      position: 'relative',
    }}>
      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .feature-card-modern {
            animation: slideIn 0.5s ease-out forwards;
            opacity: 0;
          }
          .feature-card-modern:nth-child(1) { animation-delay: 0.05s; }
          .feature-card-modern:nth-child(2) { animation-delay: 0.1s; }
          .feature-card-modern:nth-child(3) { animation-delay: 0.15s; }
          .feature-card-modern:nth-child(4) { animation-delay: 0.2s; }
          .feature-card-modern:nth-child(5) { animation-delay: 0.25s; }
        `}
      </style>

      <header className="landing-header" style={{ position: 'relative', zIndex: 10 }}>
        <div className="landing-header-content">
          <div className="flex items-center gap-3">
            <img 
              src={LOGO_URL} 
              alt="Monica Logo" 
              style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover' }}
            />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', fontFamily: 'Manrope, sans-serif', margin: 0 }}>{t('landing.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Select value={i18n.language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-[140px]" style={{ borderColor: '#E5E7EB' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')} 
              data-testid="login-btn"
              style={{ borderColor: '#E5E7EB', color: '#374151', fontWeight: '600' }}
            >
              {t('landing.login')}
            </Button>
          </div>
        </div>
      </header>

      <main className="landing-main" style={{ position: 'relative', zIndex: 5 }}>
        <section className="hero-section" style={{
          padding: '7rem 2rem 5rem',
          textAlign: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div className="hero-content">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '20px', padding: '0.4rem 1rem', marginBottom: '2rem', fontSize: '0.85rem', fontWeight: '600', color: '#92400E' }}>
              <Sparkles size={14} />
              Powered by AI — Especializado en EB-2 NIW
            </div>
            
            <h2 style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: '800',
              marginBottom: '1.5rem',
              color: '#111827',
              lineHeight: '1.15',
              fontFamily: 'Manrope, sans-serif',
              letterSpacing: '-0.02em'
            }}>{t('landing.subtitle')}</h2>
            
            <p style={{
              fontSize: '1.2rem',
              marginBottom: '3rem',
              color: '#6B7280',
              maxWidth: '600px',
              margin: '0 auto 3rem auto',
              lineHeight: '1.7'
            }}>
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

        <section className="features-section" style={{
          padding: '3rem 2rem 5rem',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <h3 style={{
            fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: '0.75rem',
            color: '#111827',
            fontFamily: 'Manrope, sans-serif',
            letterSpacing: '-0.02em'
          }}>{t('landing.features.title')}</h3>
          <p style={{
            textAlign: 'center',
            fontSize: '1.05rem',
            marginBottom: '3rem',
            color: '#6B7280',
            fontWeight: '500'
          }}>{t('landing.features.subtitle')}</p>
          <div className="features-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '4rem'
          }}>
            {[
              { icon: <FileText size={28} style={{ color: '#F8BF13' }} />, bg: '#FFFBEB', title: t('landing.features.niw'), desc: t('landing.features.niw.desc') },
              { icon: <Scale size={28} style={{ color: '#3B82F6' }} />, bg: '#EFF6FF', title: t('landing.features.patents'), desc: t('landing.features.patents.desc') },
              { icon: <Book size={28} style={{ color: '#EC4899' }} />, bg: '#FDF2F8', title: t('landing.features.books'), desc: t('landing.features.books.desc') },
              { icon: <FileText size={28} style={{ color: '#10B981' }} />, bg: '#ECFDF5', title: t('landing.features.whitepapers'), desc: t('landing.features.whitepapers.desc') },
              { icon: <BarChart3 size={28} style={{ color: '#8B5CF6' }} />, bg: '#F5F3FF', title: t('landing.features.econometric'), desc: t('landing.features.econometric.desc') },
            ].map((f, i) => (
              <div key={i} className="feature-card-modern" style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '16px',
                padding: '2rem',
                transition: 'all 0.2s ease',
                cursor: 'default',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#F8BF13';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}>
                <div style={{ width: '60px', height: '60px', background: f.bg, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  {f.icon}
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', color: '#111827', fontFamily: 'Manrope, sans-serif' }}>
                  {f.title}
                </h4>
                <p style={{ color: '#6B7280', lineHeight: '1.6', fontSize: '0.9rem' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          <h3 style={{
            fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
            fontWeight: '800',
            textAlign: 'center',
            marginTop: '3rem',
            marginBottom: '2.5rem',
            color: '#111827',
            fontFamily: 'Manrope, sans-serif',
          }}>{t('landing.comingsoon.title')}</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem'
          }}>
            {[
              { icon: <Briefcase size={24} style={{ color: '#047857' }} />, bg: '#ECFDF5', title: t('landing.comingsoon.casestudies'), desc: t('landing.comingsoon.casestudies.desc') },
              { icon: <Globe size={24} style={{ color: '#EC4899' }} />, bg: '#FDF2F8', title: t('landing.comingsoon.policy'), desc: t('landing.comingsoon.policy.desc') },
              { icon: <Mail size={24} style={{ color: '#F97316' }} />, bg: '#FFF7ED', title: t('landing.comingsoon.selfpetition'), desc: t('landing.comingsoon.selfpetition.desc') },
              { icon: <UserCheck size={24} style={{ color: '#3B82F6' }} />, bg: '#EFF6FF', title: t('landing.comingsoon.recommendation'), desc: t('landing.comingsoon.recommendation.desc') },
              { icon: <Award size={24} style={{ color: '#7C3AED' }} />, bg: '#F5F3FF', title: t('landing.comingsoon.expert'), desc: t('landing.comingsoon.expert.desc') },
            ].map((f, i) => (
              <div key={i} className="feature-card-modern" style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '14px',
                padding: '1.5rem',
                opacity: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '44px', height: '44px', background: f.bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {f.icon}
                  </div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827', fontFamily: 'Manrope, sans-serif', margin: 0 }}>{f.title}</h4>
                </div>
                <p style={{ color: '#6B7280', lineHeight: '1.5', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{f.desc}</p>
                <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', background: '#FFFBEB', color: '#92400E', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', border: '1px solid #FDE68A' }}>
                  {t('landing.comingsoon.title')}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer style={{
        background: '#F9FAFB',
        borderTop: '1px solid #E5E7EB',
        padding: '2rem 0',
        textAlign: 'center',
        marginTop: '2rem'
      }}>
        <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>© 2025 Monica. All rights reserved.</p>
      </footer>
    </div>
  );

};

export default LandingPage;
