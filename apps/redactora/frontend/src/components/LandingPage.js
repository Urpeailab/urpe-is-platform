import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { FileText, Book, Scale, BarChart3, Briefcase, Globe, Mail, UserCheck, Award, Sparkles, Zap } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_ai-bookmaker-3/artifacts/96cp2qdv_IMG_6812.jpg';

const LandingPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  return (
    <div className="landing-page" style={{
      minHeight: '100vh',
      background: '#ffffff',
      color: '#1a1a1a',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated gradient background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 20% 80%, rgba(236, 72, 153, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(168, 85, 247, 0.04) 0%, transparent 50%)
        `,
        animation: 'pulse 4s ease-in-out infinite'
      }} />
      
      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        opacity: 0.5
      }} />

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(236, 72, 153, 0.2); }
            50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.5), 0 0 80px rgba(236, 72, 153, 0.3); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .feature-card-modern {
            animation: slideIn 0.6s ease-out forwards;
            opacity: 0;
          }
          .feature-card-modern:nth-child(1) { animation-delay: 0.1s; }
          .feature-card-modern:nth-child(2) { animation-delay: 0.2s; }
          .feature-card-modern:nth-child(3) { animation-delay: 0.3s; }
          .feature-card-modern:nth-child(4) { animation-delay: 0.4s; }
          .feature-card-modern:nth-child(5) { animation-delay: 0.5s; }
        `}
      </style>

      <header className="landing-header" style={{ 
        position: 'relative', 
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
        padding: '1rem 0',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
      }}>
        <div className="landing-header-content" style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div className="flex items-center gap-3">
            <img 
              src={LOGO_URL} 
              alt="Monica Logo" 
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                objectFit: 'cover',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            />
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #1a1a1a, #4a4a4a, #2a2a2a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>{t('landing.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Select value={i18n.language} onValueChange={changeLanguage}>
              <SelectTrigger className="w-[140px]" style={{
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.3)',
                color: '#1a1a1a'
              }}>
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
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                border: '2px solid #8b5cf6',
                color: '#8b5cf6',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#8b5cf6';
                e.target.style.color = 'white';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                e.target.style.color = '#8b5cf6';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              {t('landing.login')}
            </Button>
          </div>
        </div>
      </header>

      <main className="landing-main" style={{ position: 'relative', zIndex: 5 }}>
        <section className="hero-section" style={{
          padding: '6rem 2rem',
          textAlign: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div className="hero-content">
            {/* Powered by badge removed */}
            
            <h2 style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 'bold',
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, #1a1a1a, #4a4a4a, #2a2a2a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: '1.2'
            }}>{t('landing.subtitle')}</h2>
            
            <p style={{
              fontSize: '1.25rem',
              marginBottom: '3rem',
              color: '#4a4a4a',
              maxWidth: '600px',
              margin: '0 auto 3rem auto',
              lineHeight: '1.6'
            }}>
              {t('landing.description')}
            </p>
            
            <Button 
              size="lg" 
              className="hero-button"
              onClick={() => navigate('/register')}
              data-testid="get-started-btn"
              style={{
                background: 'linear-gradient(135deg, #000000, #4a4a4a)',
                border: 'none',
                padding: '1rem 2.5rem',
                fontSize: '1.1rem',
                borderRadius: '50px',
                transition: 'all 0.3s ease',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-3px) scale(1.05)';
                e.target.style.boxShadow = '0 20px 40px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0) scale(1)';
                e.target.style.boxShadow = '0 10px 30px rgba(139, 92, 246, 0.3)';
              }}
            >
              <span style={{ position: 'relative', zIndex: 2 }}>{t('landing.getStarted')}</span>
            </Button>
          </div>
        </section>

        <section className="features-section" style={{
          padding: '4rem 2rem',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <h3 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '1rem',
            color: '#000000'
          }}>{t('landing.features.title')}</h3>
          <p style={{
            textAlign: 'center',
            fontSize: '1.1rem',
            marginBottom: '3rem',
            color: '#4a4a4a',
            fontWeight: '600'
          }}>{t('landing.features.subtitle')}</p>
          <div className="features-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem',
            marginBottom: '4rem'
          }}>
            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite'
                }}>
                  <FileText size={48} style={{ 
                    color: '#2a2a2a',
                    filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))'
                  }} />
                </div>
              </div>
              <h4 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1a1a1a', textAlign: 'center' }}>
                {t('landing.features.niw')}
              </h4>
              <p style={{ color: '#4a4a4a', lineHeight: '1.6', textAlign: 'center' }}>
                {t('landing.features.niw.desc')}
              </p>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 0.5s'
                }}>
                  <Scale size={48} color="#2a2a2a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.features.patents')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>{t('landing.features.patents.desc')}</p>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 1s'
                }}>
                  <Book size={48} color="#3a3a3a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.features.books')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>{t('landing.features.books.desc')}</p>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 1.5s'
                }}>
                  <FileText size={48} color="#4a4a4a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.features.whitepapers')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>{t('landing.features.whitepapers.desc')}</p>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 2s'
                }}>
                  <BarChart3 size={48} color="#5a5a5a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.features.econometric')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>{t('landing.features.econometric.desc')}</p>
            </div>
          </div>

          <h3 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            textAlign: 'center',
            marginTop: '4rem',
            marginBottom: '3rem',
            color: '#000000'
          }}>{t('landing.comingsoon.title')}</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
              opacity: 0.85
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.opacity = '0.85';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 0.3s'
                }}>
                  <Briefcase size={48} color="#6a6a6a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.comingsoon.casestudies')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>{t('landing.comingsoon.casestudies.desc')}</p>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                borderRadius: '50px',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {t('landing.comingsoon.title')}
              </span>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
              opacity: 0.85
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.opacity = '0.85';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 0.6s'
                }}>
                  <Globe size={48} color="#1a1a1a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.comingsoon.policy')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>{t('landing.comingsoon.policy.desc')}</p>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                borderRadius: '50px',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {t('landing.comingsoon.title')}
              </span>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
              opacity: 0.85
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.opacity = '0.85';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 0.9s'
                }}>
                  <Mail size={48} color="#4a4a4a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.comingsoon.selfpetition')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>{t('landing.comingsoon.selfpetition.desc')}</p>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                borderRadius: '50px',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {t('landing.comingsoon.title')}
              </span>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
              opacity: 0.85
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.opacity = '0.85';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 1.2s'
                }}>
                  <UserCheck size={48} color="#3a3a3a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.comingsoon.recommendation')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>{t('landing.comingsoon.recommendation.desc')}</p>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                borderRadius: '50px',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {t('landing.comingsoon.title')}
              </span>
            </div>

            <div className="feature-card-modern" style={{
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '24px',
              padding: '2.5rem',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
              opacity: 0.85
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.transform = 'translateY(-10px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
              e.currentTarget.style.opacity = '0.85';
            }}>
              <div style={{ 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {/* Glassmorphism icon container */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                  animation: 'float 3s ease-in-out infinite 1.5s'
                }}>
                  <Award size={48} color="#2a2a2a" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.2))' }} />
                </div>
              </div>
              <h4 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: '#1a1a1a',
                textAlign: 'center'
              }}>{t('landing.comingsoon.expert')}</h4>
              <p style={{
                color: '#4a4a4a',
                lineHeight: '1.6',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>{t('landing.comingsoon.expert.desc')}</p>
              <span style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                borderRadius: '50px',
                fontSize: '0.875rem',
                fontWeight: '600',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                {t('landing.comingsoon.title')}
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer style={{
        position: 'relative',
        zIndex: 10,
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        padding: '2rem 0',
        textAlign: 'center',
        marginTop: '4rem'
      }}>
        <p style={{
          color: '#4a4a4a',
          fontSize: '1rem'
        }}>© 2025 Monica. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;