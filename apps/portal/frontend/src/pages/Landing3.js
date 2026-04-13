import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileCheck, Lock, Monitor, BarChart3, Brain, Zap, AlertTriangle } from 'lucide-react';

const GOLD = '#C9A96A';
const NAVY = '#0F172A';

export default function Landing3() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4" style={{ background: NAVY }}>
        <span className="text-2xl font-bold tracking-wide" style={{ color: '#FFFFFF' }}>URPE</span>
        <button
          data-testid="landing3-info-btn"
          onClick={() => navigate('/login')}
          className="px-5 py-2.5 text-sm font-semibold tracking-wider uppercase transition-all hover:opacity-90"
          style={{ background: NAVY, color: '#FFFFFF', border: `1px solid ${GOLD}` }}
        >
          + INFO
        </button>
      </nav>
      <div className="h-[3px]" style={{ background: GOLD }} />

      {/* ═══ SECTION 1: Hero ═══ */}
      <section className="py-20 md:py-28 px-6 text-center" style={{ background: GOLD }}>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black italic leading-tight mb-6 max-w-3xl mx-auto" style={{ color: NAVY }}>
          MIENTRAS ESPERAS, QUE PASA CON TU FUTURO?
        </h1>
        <p className="text-base md:text-lg mb-12" style={{ color: NAVY }}>
          Cada dia que pasa es un dia que podrias estar en control.
        </p>
        <div className="max-w-xl mx-auto rounded-lg px-8 py-10 mb-10" style={{ background: NAVY }}>
          <p className="text-4xl md:text-5xl font-black mb-3" style={{ color: GOLD }}>93.7%</p>
          <p className="text-sm md:text-base" style={{ color: '#94A3B8' }}>
            De casos aprobados. 9 de cada 10 logran su residencia.
          </p>
        </div>
        <button
          data-testid="hero-prueba-btn"
          className="px-10 py-4 text-sm font-bold tracking-widest uppercase transition-all hover:scale-105 mb-10"
          style={{ background: NAVY, color: GOLD }}
        >
          VER PRUEBA DE EXITO
        </button>
        <div className="max-w-2xl mx-auto rounded-md px-6 py-4 flex items-center justify-center gap-2" style={{ background: NAVY }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />
          <p className="text-xs md:text-sm font-semibold tracking-wide uppercase" style={{ color: GOLD }}>
            540 PERSONAS EN MARZO TOMARON LA OPORTUNIDAD. SERA TU MOMENTO EN ABRIL?
          </p>
        </div>
      </section>

      {/* ═══ SECTION 2: El Problema ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: NAVY }}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center mb-14" style={{ color: GOLD }}>
          EL PROBLEMA QUE NO DICES EN VOZ ALTA
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto mb-4">
          {[
            { title: 'SIN CONTROL', desc: 'Tu empleador define tu futuro' },
            { title: 'SIN LIBERTAD', desc: 'Vives en pausa, no en accion' },
            { title: 'SIN CERTEZA', desc: 'No sabes que pasara manana' },
            { title: 'SIN FAMILIA', desc: 'No puedes viajar sin riesgo' },
            { title: 'SIN PAZ', desc: 'El miedo es tu companero diario' },
          ].map((item, i) => (
            <div key={i} className="rounded-lg px-5 py-8 text-center transition-all hover:-translate-y-1"
              style={{ background: GOLD }}>
              <h3 className="text-base font-black uppercase mb-3" style={{ color: NAVY }}>{item.title}</h3>
              <p className="text-sm" style={{ color: NAVY }}>{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="rounded-lg px-5 py-8 text-center transition-all hover:-translate-y-1 w-full sm:w-48"
            style={{ background: GOLD }}>
            <h3 className="text-base font-black uppercase mb-3" style={{ color: NAVY }}>SIN OPCION?</h3>
            <p className="text-sm" style={{ color: NAVY }}>FALSO. Existe una via legal y real.</p>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: Los Numeros No Mienten ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: GOLD }}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center mb-14" style={{ color: NAVY }}>
          LOS NUMEROS NO MIENTEN
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {[
            { value: '13,140', label: 'CASOS RADICADOS CORRECTAMENTE' },
            { value: '12,312', label: 'CASOS APROBADOS. PUNTO.' },
            { value: '6', sublabel: 'Meses', label: 'TIEMPO PROMEDIO DE APROBACION' },
            { value: '14', sublabel: 'Anos', label: 'EXPERIENCIA VERIFICADA EN EB2-NIW' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg px-6 py-10 text-center"
              style={{ background: NAVY }}>
              <p className="text-3xl md:text-4xl font-black leading-none" style={{ color: GOLD }}>{s.value}</p>
              {s.sublabel && <p className="text-xl md:text-2xl font-bold" style={{ color: GOLD }}>{s.sublabel}</p>}
              <p className="text-[10px] md:text-xs font-semibold tracking-wider uppercase mt-3" style={{ color: '#94A3B8' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 4: Lo Que Nos Hace Diferente ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: GOLD }}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center mb-4" style={{ color: NAVY }}>
          LO QUE NOS HACE DIFERENTE
        </h2>
        <p className="text-center text-sm md:text-base max-w-2xl mx-auto mb-14" style={{ color: NAVY }}>
          No vendemos tramites. Construimos evidencia que USCIS valida como hecho, no como promesa.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto mb-4">
          {[
            { icon: FileText, title: 'Business Plan', desc: 'Estructurado para demostrar interes nacional' },
            { icon: FileCheck, title: 'White Paper', desc: 'Profesional en tu especialidad' },
            { icon: Lock, title: 'Patente Registrada', desc: 'Validacion oficial de originalidad' },
            { icon: Monitor, title: 'App Funcional', desc: 'Prototipo tangible de tu solucion' },
            { icon: BarChart3, title: 'Estudio Econometrico', desc: 'Viabilidad financiera comprobada' },
          ].map((card, i) => (
            <div key={i} className="rounded-lg p-5 transition-all hover:-translate-y-1"
              style={{ background: GOLD, border: '2px solid #FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="h-4 w-4" style={{ color: NAVY }} />
                <h3 className="text-sm font-bold" style={{ color: NAVY }}>{card.title}</h3>
              </div>
              <p className="text-xs" style={{ color: NAVY }}>{card.desc}</p>
            </div>
          ))}
        </div>
        <div className="max-w-5xl mx-auto">
          <div className="rounded-lg p-5 transition-all hover:-translate-y-1 w-full sm:w-48"
            style={{ background: GOLD, border: '2px solid #FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4" style={{ color: NAVY }} />
              <h3 className="text-sm font-bold" style={{ color: NAVY }}>Cerebro IA para RFE</h3>
            </div>
            <p className="text-xs" style={{ color: NAVY }}>Respuestas automaticas con 93.7% exito</p>
          </div>
        </div>
      </section>

      {/* ═══ SECTION 5: CTA Final ═══ */}
      <section className="py-20 md:py-28 px-6 text-center" style={{ background: GOLD }}>
        <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black leading-tight mb-6 max-w-4xl mx-auto" style={{ color: NAVY }}>
          LAS LEYES CAMBIAN. LAS OPORTUNIDADES SE CIERRAN. EL TIEMPO NO ESPERA.
        </h2>
        <p className="text-base md:text-lg mb-12" style={{ color: NAVY }}>
          Obten tu reporte de elegibilidad GRATIS. Descubre exactamente donde estas.
        </p>
        <a
          href="https://wa.me/17315038255?text=Hola%2C%20quiero%20aplicar%20para%20mi%20evaluacion%20de%20elegibilidad"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="cta-aplica-btn"
          className="inline-block px-10 py-5 text-sm md:text-base font-bold tracking-widest uppercase transition-all hover:scale-105 mb-10"
          style={{ background: NAVY, color: GOLD }}
        >
          ACCESO LIMITADO - APLICA AHORA
        </a>
        <p className="text-xs md:text-sm font-semibold flex items-center justify-center gap-2 tracking-wide uppercase" style={{ color: NAVY }}>
          <Zap className="h-4 w-4" />
          PLAZAS LIMITADAS PARA ABRIL 2026. ESTE NO ES UN ANUNCIO. ES TU OPORTUNIDAD.
        </p>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-10 px-6 text-center" style={{ background: NAVY }}>
        <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>
          &copy; 2026 URPE Integral Services - EB2-NIW | ASILO | PETICIONES FAMILIARES
        </p>
        <p className="text-xs" style={{ color: '#64748B' }}>
          Certificado de excelencia en inmigracion. 14 anos transformando vidas.
        </p>
      </footer>
    </div>
  );
}
