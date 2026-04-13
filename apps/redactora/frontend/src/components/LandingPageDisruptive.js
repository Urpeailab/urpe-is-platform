import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { FileText, Book, Scale, BarChart3, Briefcase, Globe, Mail, UserCheck, Award, Sparkles, Zap, ArrowRight, Star } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LandingPageDisruptive = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cursorVariant, setCursorVariant] = useState('default');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const features = [
    { 
      icon: FileText, 
      title: t('landing.features.niw'), 
      desc: t('landing.features.niw.desc'),
      color: '#6366f1',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      delay: 0
    },
    { 
      icon: Scale, 
      title: t('landing.features.patents'), 
      desc: t('landing.features.patents.desc'),
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      delay: 0.1
    },
    { 
      icon: Book, 
      title: t('landing.features.books'), 
      desc: t('landing.features.books.desc'),
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      delay: 0.2
    },
    { 
      icon: FileText, 
      title: t('landing.features.whitepapers'), 
      desc: t('landing.features.whitepapers.desc'),
      color: '#14b8a6',
      gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
      delay: 0.3
    },
    { 
      icon: BarChart3, 
      title: t('landing.features.econometric'), 
      desc: t('landing.features.econometric.desc'),
      color: '#f97316',
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      delay: 0.4
    },
  ];

  const comingSoon = [
    { icon: Briefcase, title: t('landing.comingsoon.casestudies'), desc: t('landing.comingsoon.casestudies.desc'), color: '#f59e0b' },
    { icon: Globe, title: t('landing.comingsoon.policy'), desc: t('landing.comingsoon.policy.desc'), color: '#a855f7' },
    { icon: Mail, title: t('landing.comingsoon.selfpetition'), desc: t('landing.comingsoon.selfpetition.desc'), color: '#06b6d4' },
    { icon: UserCheck, title: t('landing.comingsoon.recommendation'), desc: t('landing.comingsoon.recommendation.desc'), color: '#ec4899' },
    { icon: Award, title: t('landing.comingsoon.expert'), desc: t('landing.comingsoon.expert.desc'), color: '#8b5cf6' },
  ];

  return (
    <div style={{
      background: '#000',
      color: '#fff',
      minHeight: '100vh',
      overflow: 'hidden',
      position: 'relative',
      cursor: 'none'
    }}>
      {/* Custom Cursor */}
      <div style={{
        position: 'fixed',
        left: mousePos.x - 10,
        top: mousePos.y - 10,
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.5)',
        pointerEvents: 'none',
        zIndex: 10000,
        transition: 'all 0.1s ease',
        transform: cursorVariant === 'hover' ? 'scale(2)' : 'scale(1)',
        mixBlendMode: 'screen'
      }} />

      {/* Animated Background Mesh */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `
          radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(139, 92, 246, 0.15), transparent 50%),
          radial-gradient(circle at ${100 - mousePos.x / 20}% ${mousePos.y / 20}%, rgba(236, 72, 153, 0.1), transparent 50%),
          radial-gradient(circle at ${mousePos.x / 20}% ${100 - mousePos.y / 20}%, rgba(59, 130, 246, 0.1), transparent 50%)
        `,
        zIndex: 0
      }} />

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <div key={i} style={{
          position: 'fixed',
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${Math.random() * 4 + 1}px`,
          height: `${Math.random() * 4 + 1}px`,
          background: `rgba(${Math.random() * 255}, ${Math.random() * 255}, 255, ${Math.random() * 0.5})`,
          borderRadius: '50%',
          animation: `float ${Math.random() * 10 + 5}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 5}s`,
          zIndex: 1
        }} />
      ))}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-30px) translateX(10px); }
          50% { transform: translateY(-60px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(10px); }
        }
        @keyframes glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
        }
        @keyframes rotate3d {
          0% { transform: perspective(1000px) rotateY(0deg) rotateX(0deg); }
          100% { transform: perspective(1000px) rotateY(360deg) rotateX(360deg); }
        }
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
          50% { box-shadow: 0 0 0 20px rgba(139, 92, 246, 0); }
        }
        @keyframes text-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .glitch-text {
          animation: glitch 0.3s infinite;
        }
        .text-glowing {
          background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #667eea);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: text-gradient 3s ease infinite;
        }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '1.5rem 3rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '50px',
            height: '50px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rotate3d 10s linear infinite'
          }}>
            <Sparkles size={28} />
          </div>
          <h1 className="text-glowing" style={{
            fontSize: '2.5rem',
            fontWeight: 'black',
            letterSpacing: '-0.05em'
          }}>MONICA</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Select value={i18n.language} onValueChange={changeLanguage}>
            <SelectTrigger style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: 'white',
              cursor: 'none'
            }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">🇪🇸 Español</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={() => navigate('/login')}
            style={{
              background: 'transparent',
              border: '2px solid rgba(139, 92, 246, 0.5)',
              color: 'white',
              padding: '0.75rem 2rem',
              fontWeight: 'bold',
              cursor: 'none',
              transition: 'all 0.3s'
            }}
            onMouseEnter={() => setCursorVariant('hover')}
            onMouseLeave={() => setCursorVariant('default')}
          >
            {t('landing.login')}
          </Button>
        </div>
      </header>

      {/* Hero Section - Asymmetric Layout */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 10,
        padding: '0 3rem',
        transform: `translateY(${scrollY * 0.5}px)`
      }}>
        <div style={{
          maxWidth: '1400px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '4rem',
          alignItems: 'center'
        }}>
          {/* Left Side */}
          <div>
            {/* Powered by badge removed */}

            <h1 style={{
              fontSize: 'clamp(3rem, 8vw, 6rem)',
              fontWeight: '900',
              lineHeight: '1',
              marginBottom: '1.5rem',
              letterSpacing: '-0.05em'
            }}>
              <span className="text-glowing">{t('landing.subtitle').split(' ')[0]}</span>
              <br />
              <span style={{ color: '#fff' }}>{t('landing.subtitle').split(' ').slice(1).join(' ')}</span>
            </h1>

            <p style={{
              fontSize: '1.25rem',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '3rem',
              maxWidth: '600px',
              lineHeight: '1.6'
            }}>
              {t('landing.description')}
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button
                onClick={() => navigate('/register')}
                style={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  border: 'none',
                  padding: '1.25rem 3rem',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: '50px',
                  cursor: 'none',
                  boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={() => setCursorVariant('hover')}
                onMouseLeave={() => setCursorVariant('default')}
              >
                {t('landing.getStarted')} <ArrowRight style={{ marginLeft: '0.5rem' }} size={20} />
              </Button>
            </div>
          </div>

          {/* Right Side - 3D Floating Cards */}
          <div style={{
            position: 'relative',
            height: '600px'
          }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: '200px',
                height: '120px',
                background: `linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))`,
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '20px',
                left: `${(i % 2) * 50}%`,
                top: `${i * 20}%`,
                transform: `
                  perspective(1000px) 
                  rotateY(${mousePos.x / 50 - 10}deg) 
                  rotateX(${mousePos.y / 50 - 10}deg)
                  translateZ(${i * 20}px)
                `,
                transition: 'transform 0.1s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3rem',
                animation: `float ${5 + i}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`
              }}>
                {['📄', '⚖️', '📚', '📊', '✉️'][i]}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features - Horizontal Scroll Section */}
      <section style={{
        padding: '8rem 0',
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '4rem',
          padding: '0 3rem'
        }}>
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: '900',
            marginBottom: '1rem'
          }}>
            <span className="text-glowing">{t('landing.features.title')}</span>
          </h2>
          <p style={{
            fontSize: '1.2rem',
            color: '#8b5cf6',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.2em'
          }}>
            {t('landing.features.subtitle')}
          </p>
        </div>

        {/* Horizontal Scrolling Cards */}
        <div style={{
          display: 'flex',
          gap: '2rem',
          padding: '0 3rem 3rem 3rem',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                style={{
                  minWidth: '400px',
                  height: '500px',
                  background: `linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.4))`,
                  backdropFilter: 'blur(20px)',
                  border: `2px solid ${feature.color}`,
                  borderRadius: '30px',
                  padding: '3rem',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'none',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: `perspective(1000px) rotateY(${(mousePos.x / window.innerWidth - 0.5) * 10}deg)`,
                  animation: `float ${5 + index}s ease-in-out infinite`,
                  animationDelay: `${feature.delay}s`
                }}
                onMouseEnter={() => setCursorVariant('hover')}
                onMouseLeave={() => setCursorVariant('default')}
              >
                {/* Gradient Overlay */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: feature.gradient,
                  opacity: 0.1,
                  borderRadius: '30px'
                }} />

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    background: feature.gradient,
                    borderRadius: '25px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '2rem',
                    animation: 'pulse-border 2s infinite',
                    boxShadow: `0 0 40px ${feature.color}`
                  }}>
                    <Icon size={50} color="#fff" />
                  </div>

                  <h3 style={{
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    marginBottom: '1rem',
                    color: feature.color
                  }}>
                    {feature.title}
                  </h3>

                  <p style={{
                    fontSize: '1.1rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: '1.6',
                    flex: 1
                  }}>
                    {feature.desc}
                  </p>

                  <div style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: feature.color,
                    fontWeight: 'bold'
                  }}>
                    <Star size={20} fill={feature.color} />
                    ACTIVE
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Coming Soon - Bento Grid */}
      <section style={{
        padding: '8rem 3rem',
        position: 'relative',
        zIndex: 10
      }}>
        <h2 style={{
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: '900',
          textAlign: 'center',
          marginBottom: '4rem'
        }}>
          <span className="glitch-text text-glowing">{t('landing.comingsoon.title')}</span>
        </h2>

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          {comingSoon.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${item.color}50`,
                  borderRadius: '20px',
                  padding: '2.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'none',
                  opacity: 0.7,
                  transition: 'all 0.3s',
                  transform: `rotate(${Math.random() * 4 - 2}deg)`
                }}
                onMouseEnter={(e) => {
                  setCursorVariant('hover');
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'rotate(0deg) scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  setCursorVariant('default');
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.transform = `rotate(${Math.random() * 4 - 2}deg) scale(1)`;
                }}
              >
                <div style={{
                  width: '70px',
                  height: '70px',
                  background: item.color,
                  borderRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <Icon size={35} color="#000" />
                </div>

                <h4 style={{
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  marginBottom: '0.75rem',
                  color: '#fff'
                }}>
                  {item.title}
                </h4>

                <p style={{
                  fontSize: '1rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '1.5rem',
                  lineHeight: '1.5'
                }}>
                  {item.desc}
                </p>

                <div style={{
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  background: item.color,
                  color: '#000',
                  borderRadius: '50px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}>
                  {t('landing.comingsoon.title')}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '3rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        position: 'relative',
        zIndex: 10
      }}>
        <p style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          © 2024 Monica
        </p>
      </footer>
    </div>
  );
};

export default LandingPageDisruptive;
