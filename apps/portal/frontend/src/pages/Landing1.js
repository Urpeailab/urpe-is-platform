import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Link2, Plane, FileText, FileCheck, Lock, Monitor, BarChart3, Trophy, Check, Briefcase, AlertTriangle, ShieldOff, HelpCircle, Unlink, Users, CloudLightning, Volume2, VolumeX, Pause, Play } from 'lucide-react';

const VIDEO_URL = 'https://customer-assets.emergentagent.com/job_d400b0d5-e5db-4967-a060-670dc95bd1ae/artifacts/q4f33vjm_IMG_2835.MOV';

export default function Landing1() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const hasUnmutedRef = useRef(false);

  const handleVideoBtn = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (muted) {
      vid.currentTime = 0;
      vid.muted = false;
      setMuted(false);
      hasUnmutedRef.current = true;
      vid.play();
      setPlaying(true);
    } else {
      if (playing) {
        vid.pause();
        setPlaying(false);
      } else {
        vid.play();
        setPlaying(true);
      }
    }
  }, [muted, playing]);

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4" style={{ background: '#0F172A', borderBottom: '2px solid #C9A96A' }}>
        <span className="text-2xl font-bold tracking-wide" style={{ color: '#C9A96A' }}>URPE</span>
        <button
          data-testid="landing-login-btn"
          onClick={() => navigate('/login')}
          className="px-6 py-2.5 rounded-full text-sm font-semibold border-2 transition-all hover:opacity-90"
          style={{ borderColor: '#C9A96A', color: '#C9A96A', background: 'transparent' }}
        >
          Iniciar Sesion
        </button>
      </nav>

      {/* ═══ SECTION 1: Hero ═══ */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 md:py-28" style={{ background: '#0F172A', minHeight: '80vh' }}>
        <p className="text-sm md:text-base font-semibold tracking-[0.2em] uppercase mb-6" style={{ color: '#C9A96A' }}>
          EL VERDADERO CAMINO A LA RESIDENCIA
        </p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6 max-w-3xl" style={{ color: '#FFFFFF' }}>
          El Verdadero Dolor del Inmigrante
        </h1>
        <p className="text-base md:text-lg max-w-2xl mb-10" style={{ color: '#94A3B8' }}>
          No es trabajar duro. Es vivir con miedo. Conoce la solucion que 12,312 profesionales ya encontraron.
        </p>
        <div className="relative w-full max-w-2xl rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 60px rgba(201,169,106,0.15)' }}>
          {!videoLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl" style={{ background: '#1E293B' }}>
              <div className="relative h-14 w-14 mb-4">
                <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(201,169,106,0.15)' }} />
                <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '3px solid transparent', borderTopColor: '#C9A96A', borderRightColor: '#C9A96A' }} />
                <div className="absolute inset-2 rounded-full" style={{ background: '#1E293B' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-5 w-5 ml-0.5" style={{ color: '#C9A96A' }} />
                </div>
              </div>
              <p className="text-sm font-medium tracking-wide" style={{ color: '#C9A96A' }}>Cargando video...</p>
            </div>
          )}
          <video
            ref={videoRef}
            src={VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setVideoLoaded(true)}
            className="w-full rounded-2xl transition-opacity duration-500"
            style={{ aspectRatio: '16/9', objectFit: 'cover', opacity: videoLoaded ? 1 : 0 }}
          />
          <button
            data-testid="hero-mute-btn"
            onClick={handleVideoBtn}
            className="absolute bottom-4 right-4 h-11 w-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(201,169,106,0.4)' }}
          >
            {muted
              ? <VolumeX className="h-5 w-5" style={{ color: '#C9A96A' }} />
              : playing
                ? <Pause className="h-5 w-5" style={{ color: '#C9A96A' }} />
                : <Play className="h-5 w-5" style={{ color: '#C9A96A' }} />
            }
          </button>
        </div>
      </section>

      {/* ═══ SECTION 2: Reconoce Tu Situacion ═══ */}
      <section className="py-20 md:py-28 px-6 relative overflow-hidden" style={{ background: '#FFFFFF' }}>
        <div className="relative z-10">
          <p className="text-sm font-semibold tracking-[0.25em] uppercase text-center mb-4" style={{ color: '#C9A96A' }}>
            LA REALIDAD QUE NADIE TE DICE
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-4" style={{ color: '#0F172A' }}>
            Reconoce Tu Situacion
          </h2>
          <p className="text-center text-base max-w-xl mx-auto mb-16" style={{ color: '#64748B' }}>
            Millones de profesionales viven atrapados en estas 5 realidades. Identificarlas es el primer paso.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-6xl mx-auto">
            {[
              { icon: ShieldOff, title: 'Sin Control', desc: 'Tu futuro depende de tu empleador, no de ti', num: '01' },
              { icon: HelpCircle, title: 'Sin Certeza', desc: 'No sabes que pasara en 1, 2 o 5 anos', num: '02' },
              { icon: Unlink, title: 'Sin Libertad', desc: 'Vives en pausa, con ansiedad y estres', num: '03' },
              { icon: Users, title: 'Sin Familia', desc: 'No puedes viajar sin riesgo', num: '04' },
              { icon: CloudLightning, title: 'Sin Paz', desc: 'El miedo limita tu potencial real', num: '05' },
            ].map((item, i) => (
              <div key={i} className="group relative rounded-2xl p-6 pt-8 text-center transition-all duration-300 hover:-translate-y-2 cursor-default"
                style={{ background: '#FAFBFC', border: '1px solid #E8E0D0', boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}>
                <span className="absolute top-3 right-4 text-xs font-mono font-bold" style={{ color: 'rgba(201,169,106,0.35)' }}>{item.num}</span>
                <div className="flex justify-center mb-5">
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{ background: '#0F172A' }}>
                    <item.icon className="h-7 w-7" style={{ color: '#C9A96A' }} />
                  </div>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#0F172A' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{item.desc}</p>
                <div className="mt-5 h-[2px] w-10 mx-auto rounded-full transition-all duration-300 group-hover:w-16" style={{ background: 'linear-gradient(90deg, transparent, #C9A96A, transparent)' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: Existe Un Camino ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#0F172A' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-4" style={{ color: '#FFFFFF' }}>
          Existe Un Camino
        </h2>
        <p className="text-center text-base md:text-lg font-semibold mb-14" style={{ color: '#C9A96A' }}>
          EB2-NIW: Residencia Basada en TI, No en Tu Empleador
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: Target, title: 'Sin Patrocinador', desc: 'Tu eres tu propio peticionario.' },
            { icon: Link2, title: 'Sin Dependencia', desc: 'Cambia de trabajo, negocia mejor salario.' },
            { icon: Plane, title: 'Sin Asilo', desc: 'Viaja sin riesgo, ve a tu familia.' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-8 text-center transition-all hover:-translate-y-1"
              style={{ background: '#1E293B', border: '2px solid #C9A96A33', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex justify-center mb-5">
                <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: '#0F172A' }}>
                  <item.icon className="h-8 w-8" style={{ color: '#C9A96A' }} />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#FFFFFF' }}>{item.title}</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 4: No Vendemos Tramites ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#FFFFFF' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-14" style={{ color: '#0F172A' }}>
          No Vendemos Tramites. Construimos Proyectos Reales.
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5 max-w-5xl mx-auto">
          {[
            { icon: FileText, title: 'Business Plan', desc: 'Solido y documentado' },
            { icon: FileCheck, title: 'White Paper', desc: 'Profesional e innovador' },
            { icon: Lock, title: 'Patente Registrada', desc: 'Validada y oficial' },
            { icon: Monitor, title: 'App Funcional', desc: 'Prototipo tangible' },
            { icon: BarChart3, title: 'Estudio Econometrico', desc: 'Viabilidad comprobada' },
            { icon: Trophy, title: 'Certificacion', desc: 'De innovacion oficial' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-6 text-center transition-all hover:-translate-y-1"
              style={{ background: '#F8F9FA', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex justify-center mb-4">
                <item.icon className="h-10 w-10" style={{ color: '#64748B' }} />
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: '#0F172A' }}>{item.title}</h3>
              <p className="text-sm" style={{ color: '#64748B' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 5: 93.7% de Aprobacion ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#C9A96A' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-3" style={{ color: '#0F172A' }}>
          93.7% de Aprobacion
        </h2>
        <p className="text-center text-base md:text-lg mb-14" style={{ color: '#1E293B' }}>
          No por suerte. Por evidencia y estructura.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { initials: 'DC', name: 'Dr. Carlos Martinez', role: 'Cirujano Cardiologo', quote: 'Aprobado en 6 meses', date: 'Aprobado Abril 2024' },
            { initials: 'EL', name: 'Ing. Eliana Lopez', role: 'Ingeniera de Software', quote: 'Cambie de trabajo sin miedo', date: 'Aprobado Marzo 2024' },
            { initials: 'JG', name: 'Javier Gonzalez', role: 'Emprendedor Tech', quote: 'Mi empresa esta reconocida', date: 'Aprobado Mayo 2024' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-8 text-center transition-all hover:-translate-y-1"
              style={{ background: '#FFFFFF', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ background: '#0F172A', color: '#FFFFFF' }}>
                  {item.initials}
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#0F172A' }}>{item.name}</h3>
              <p className="text-sm italic mb-3" style={{ color: '#64748B' }}>{item.role}</p>
              <p className="text-sm font-medium mb-3" style={{ color: '#374151' }}>"{item.quote}"</p>
              <p className="text-sm font-semibold flex items-center justify-center gap-1" style={{ color: '#C9A96A' }}>
                <Check className="h-4 w-4" />{item.date}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 6: En URPE Te Damos Sin Costo ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#FFFFFF' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-14" style={{ color: '#0F172A' }}>
          En URPE Te Damos Sin Costo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: FileText, title: 'Reporte Completo', desc: 'Analisis de tu elegibilidad' },
            { icon: Briefcase, title: 'Ruta Personalizada', desc: 'Paso a paso para tu aprobacion' },
            { icon: Lock, title: 'Sin Costo. Sin Riesgo.', desc: 'Claridad, direccion y control' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-10 text-center transition-all hover:-translate-y-1"
              style={{ background: '#F0F4F8', border: '2px solid #C9A96A', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div className="flex justify-center mb-5">
                <item.icon className="h-12 w-12" style={{ color: '#C9A96A' }} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#0F172A' }}>{item.title}</h3>
              <p className="text-sm" style={{ color: '#64748B' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 7: CTA Final ═══ */}
      <section className="py-20 md:py-28 px-6 text-center" style={{ background: '#0F172A' }}>
        <p className="text-base md:text-lg mb-4" style={{ color: '#CBD5E1' }}>
          Las leyes migratorias cambian. El tiempo no espera por nadie.
        </p>
        <p className="text-base md:text-lg font-semibold mb-10" style={{ color: '#FFFFFF' }}>
          Si sabes que mereces mas que vivir con miedo, este es tu momento.
        </p>
        <a
          href="https://wa.me/17315038255?text=Hola%2C%20quiero%20agendar%20mi%20consulta%20gratuita"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="cta-consulta-btn"
          className="inline-block px-10 py-5 rounded-full text-base md:text-lg font-bold tracking-wide uppercase transition-all hover:scale-105 mb-6"
          style={{ background: '#C9A96A', color: '#0F172A', boxShadow: '0 0 40px rgba(201,169,106,0.25)' }}
        >
          AGENDA TU CONSULTA GRATUITA AHORA
        </a>
        <p className="text-sm font-semibold flex items-center justify-center gap-1.5" style={{ color: '#C9A96A' }}>
          <AlertTriangle className="h-4 w-4" />Plazas limitadas en Abril 2026
        </p>
      </section>

      {/* ═══ SECTION 8: Metodologia de Entregables ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-sm md:text-base font-semibold tracking-[0.2em] uppercase text-center mb-4" style={{ color: '#C9A96A' }}>
            NUESTRA METODOLOGIA
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-4" style={{ color: '#0F172A' }}>
            Un Sistema Que Trabaja Por Ti
          </h2>
          <p className="text-base md:text-lg text-center max-w-2xl mx-auto mb-16" style={{ color: '#64748B' }}>
            Mientras otros abogados te piden documentos y esperan, nosotros construimos tu caso pieza por pieza con un sistema de entregables progresivos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {[
              { icon: Target, title: 'Entregables, No Promesas', desc: 'Cada etapa de tu caso produce un documento tangible: reportes, estrategias, evidencia. Siempre sabes exactamente donde esta tu caso y que sigue.' },
              { icon: Lock, title: 'Nada Se Improvisa', desc: 'Tu caso avanza a traves de etapas validadas por expertos. Cada entregable se construye sobre el anterior, eliminando errores y sorpresas.' },
              { icon: Monitor, title: 'Visibilidad Total 24/7', desc: 'Desde tu dashboard personal ves cada entregable, cada avance, cada documento generado. Sin llamar, sin preguntar, sin esperar.' },
              { icon: CloudLightning, title: 'Tecnologia + Estrategia Legal', desc: 'Usamos inteligencia artificial para generar borradores, analizar elegibilidad y acelerar la preparacion. Tu equipo legal revisa y perfecciona cada pieza.' },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl p-8 transition-all hover:-translate-y-1"
                style={{ background: '#0F172A', border: '1px solid #1E293B' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(201,169,106,0.1)', border: '1px solid rgba(201,169,106,0.2)' }}>
                  <item.icon className="h-6 w-6" style={{ color: '#C9A96A' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#FFFFFF' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Comparison strip */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid #C9A96A' }}>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8" style={{ background: '#FEF2F2' }}>
                <h4 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: '#991B1B' }}>
                  <ShieldOff className="h-5 w-5" /> El Proceso Tradicional
                </h4>
                <ul className="space-y-2.5">
                  {[
                    'Entregas documentos y esperas meses sin saber que pasa',
                    'Dependes de un solo abogado sin sistema estandarizado',
                    'Recibes tu caso armado al final sin entender la estrategia',
                    'Si algo falla, empiezas desde cero',
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#991B1B' }}>
                      <Unlink className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-8" style={{ background: '#F0FDF4' }}>
                <h4 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: '#166534' }}>
                  <FileCheck className="h-5 w-5" /> El Sistema URPE
                </h4>
                <ul className="space-y-2.5">
                  {[
                    'Recibes entregables concretos en cada etapa con visibilidad total',
                    'Un equipo multidisciplinario respalda cada pieza de tu caso',
                    'Participas activamente: eliges, validas y apruebas cada entregable',
                    'Cada etapa queda documentada. Nada se pierde, todo se construye',
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#166534' }}>
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-10 px-6 text-center" style={{ background: '#1E293B', borderTop: '1px solid #334155' }}>
        <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>
          &copy; 2026 URPE Integral Services. Todos los derechos reservados.
        </p>
        <p className="text-xs" style={{ color: '#64748B' }}>
          Optimizando procesos migratorios con tecnologia inteligente y orientacion experta.
        </p>
      </footer>
    </div>
  );
}
