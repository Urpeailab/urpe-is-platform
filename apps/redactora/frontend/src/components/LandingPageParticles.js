import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const LandingPageParticles = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const canvasRef = useRef(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [particles, setParticles] = useState([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  const sections = [
    { 
      text: 'MONICA', 
      subtext: t('landing.subtitle'),
      color: '#8b5cf6'
    },
    { 
      text: t('landing.features.niw').toUpperCase(), 
      subtext: t('landing.features.niw.desc'),
      color: '#6366f1'
    },
    { 
      text: t('landing.features.patents').toUpperCase(), 
      subtext: t('landing.features.patents.desc'),
      color: '#3b82f6'
    },
    { 
      text: t('landing.features.books').toUpperCase(), 
      subtext: t('landing.features.books.desc'),
      color: '#10b981'
    },
    { 
      text: t('landing.features.whitepapers').toUpperCase(), 
      subtext: t('landing.features.whitepapers.desc'),
      color: '#14b8a6'
    },
    { 
      text: t('landing.features.econometric').toUpperCase(), 
      subtext: t('landing.features.econometric.desc'),
      color: '#f97316'
    },
  ];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Particle {
      constructor(x, y, targetX, targetY, color) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.targetX = targetX;
        this.targetY = targetY;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 2 + 1;
        this.color = color;
        this.alpha = Math.random();
        this.friction = 0.95;
        this.ease = 0.03;
      }

      update(mouseX, mouseY) {
        // Mouse repulsion
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const forceDirectionX = dx / distance;
        const forceDirectionY = dy / distance;
        const maxDistance = 150;
        const force = (maxDistance - distance) / maxDistance;

        if (distance < maxDistance) {
          this.vx -= forceDirectionX * force * 8;
          this.vy -= forceDirectionY * force * 8;
        }

        // Return to target
        const dxTarget = this.targetX - this.x;
        const dyTarget = this.targetY - this.y;
        this.vx += dxTarget * this.ease;
        this.vy += dyTarget * this.ease;

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx;
        this.y += this.vy;

        // Fade in/out
        if (distance < maxDistance) {
          this.alpha = Math.max(0.1, this.alpha - 0.02);
        } else {
          this.alpha = Math.min(1, this.alpha + 0.02);
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `${this.color}${Math.floor(this.alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
      }
    }

    let particlesArray = [];

    const createTextParticles = (text, color) => {
      // Clear canvas to measure text
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set large font for text
      const fontSize = Math.min(canvas.width / 8, 120);
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textWidth = ctx.measureText(text).width;
      const x = canvas.width / 2;
      const y = canvas.height / 3;
      
      ctx.fillText(text, x, y);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      particlesArray = [];
      
      // Sample pixels to create particles
      const gap = 4; // Spacing between particles
      for (let y = 0; y < canvas.height; y += gap) {
        for (let x = 0; x < canvas.width; x += gap) {
          const index = (y * canvas.width + x) * 4;
          const alpha = pixels[index + 3];
          
          if (alpha > 128) { // If pixel is visible
            particlesArray.push(new Particle(x, y, x, y, color));
          }
        }
      }
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particlesArray.forEach(particle => {
        particle.update(mouseRef.current.x, mouseRef.current.y);
        particle.draw();
      });

      // Draw connections between nearby particles
      for (let i = 0; i < particlesArray.length; i++) {
        for (let j = i + 1; j < particlesArray.length; j++) {
          const dx = particlesArray[i].x - particlesArray[j].x;
          const dy = particlesArray[i].y - particlesArray[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 50) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 * (1 - distance / 50)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particlesArray[i].x, particlesArray[i].y);
            ctx.lineTo(particlesArray[j].x, particlesArray[j].y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    // Initial text
    createTextParticles(sections[currentSection].text, sections[currentSection].color);
    animate();

    // Mouse move handler
    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    // Click handler to change sections
    const handleClick = () => {
      setCurrentSection((prev) => (prev + 1) % sections.length);
    };

    // Resize handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      createTextParticles(sections[currentSection].text, sections[currentSection].color);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [currentSection, sections]);

  // Update particles when section changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear and redraw with new text
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fontSize = Math.min(canvas.width / 8, 120);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sections[currentSection].text, canvas.width / 2, canvas.height / 3);
  }, [currentSection, sections]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#000',
      position: 'relative',
      cursor: 'none'
    }}>
      {/* Canvas for particles */}
      <canvas 
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {/* Custom cursor */}
      <div style={{
        position: 'fixed',
        width: '20px',
        height: '20px',
        border: '2px solid #8b5cf6',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 10000,
        transform: 'translate(-50%, -50%)',
        left: mouseRef.current.x,
        top: mouseRef.current.y,
        transition: 'width 0.2s, height 0.2s',
        boxShadow: '0 0 20px #8b5cf6'
      }} />

      {/* UI Overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)'
      }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: 'black',
          color: '#8b5cf6',
          textShadow: '0 0 20px #8b5cf6',
          letterSpacing: '0.2em'
        }}>
          MONICA
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Select value={i18n.language} onValueChange={changeLanguage}>
            <SelectTrigger style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              color: 'white',
              backdropFilter: 'blur(10px)'
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
              background: 'rgba(139, 92, 246, 0.2)',
              border: '2px solid #8b5cf6',
              color: 'white',
              backdropFilter: 'blur(10px)',
              fontWeight: 'bold',
              padding: '0.75rem 2rem',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
            }}
          >
            {t('landing.login')}
          </Button>
        </div>
      </div>

      {/* Bottom Info */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '3rem',
        zIndex: 100,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)'
      }}>
        <p style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '1.1rem',
          maxWidth: '800px',
          margin: '0 auto 2rem auto',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          {sections[currentSection].subtext}
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2rem',
          flexWrap: 'wrap'
        }}>
          <Button
            onClick={() => navigate('/register')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none',
              padding: '1rem 3rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              boxShadow: '0 10px 40px rgba(139, 92, 246, 0.5)',
              color: 'white'
            }}
          >
            {t('landing.getStarted')}
          </Button>

          <div style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <span>Sección {currentSection + 1} de {sections.length}</span>
            <span>|</span>
            <span>Haz clic para continuar</span>
          </div>
        </div>
      </div>

      {/* Ambient particles */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}>
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              background: sections[currentSection].color,
              borderRadius: '50%',
              opacity: Math.random() * 0.5,
              animation: `float ${Math.random() * 10 + 5}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
              boxShadow: `0 0 ${Math.random() * 20 + 10}px ${sections[currentSection].color}`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(${Math.random() * 50 - 25}px, ${Math.random() * 50 - 25}px); }
          50% { transform: translate(${Math.random() * 50 - 25}px, ${Math.random() * 50 - 25}px); }
          75% { transform: translate(${Math.random() * 50 - 25}px, ${Math.random() * 50 - 25}px); }
        }
      `}</style>
    </div>
  );
};

export default LandingPageParticles;
