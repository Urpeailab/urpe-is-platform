import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FolderOpen, Lock, Brain, Check } from 'lucide-react';

export default function Landing2() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4" style={{ background: '#0F172A' }}>
        <span className="text-2xl font-bold tracking-wide" style={{ color: '#FFFFFF' }}>URPE</span>
        <button
          data-testid="landing2-login-btn"
          onClick={() => navigate('/login')}
          className="px-6 py-2.5 rounded text-sm font-semibold border transition-all hover:opacity-90"
          style={{ borderColor: '#C9A96A', color: '#FFFFFF', background: 'transparent' }}
        >
          Iniciar Sesion
        </button>
      </nav>
      <div className="h-[3px]" style={{ background: '#C9A96A' }} />

      {/* ═══ SECTION 1: Hero ═══ */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-24" style={{ background: '#0F172A' }}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 max-w-xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-6" style={{ color: '#FFFFFF' }}>
              EB2-NIW: Residencia Permanente Basada en Tu Merito
            </h1>
            <p className="text-base md:text-lg mb-10 leading-relaxed" style={{ color: '#94A3B8' }}>
              Para profesionales que merecen control total sobre su futuro migratorio. Sin patrocinador. Sin dependencia. Sin asilo.
            </p>
            <button
              data-testid="hero-elegibilidad-btn"
              className="px-8 py-4 rounded text-sm font-bold tracking-widest uppercase transition-all hover:scale-105"
              style={{ background: '#C9A96A', color: '#0F172A' }}
            >
              VERIFICAR MI ELEGIBILIDAD
            </button>
          </div>
          <div className="flex-shrink-0 grid grid-cols-3 gap-3 md:gap-4">
            {[
              { value: '93.7%', label: 'TASA DE APROBACION' },
              { value: '13,140', label: 'CASOS RADICADOS' },
              { value: '14', sublabel: 'Anos', label: 'EXPERIENCIA VERIFICADA' },
            ].map((s, i) => (
              <div key={i} className="rounded-lg px-5 py-8 md:px-7 md:py-10 flex flex-col justify-center"
                style={{ background: '#1E293B', borderLeft: '3px solid #C9A96A' }}>
                <span className="text-2xl md:text-3xl font-black leading-none mb-1" style={{ color: '#C9A96A' }}>{s.value}</span>
                {s.sublabel && <span className="text-lg md:text-xl font-bold" style={{ color: '#C9A96A' }}>{s.sublabel}</span>}
                <span className="text-[10px] md:text-xs font-semibold tracking-wider uppercase mt-2" style={{ color: '#94A3B8' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2: Numeros Que Hablan ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#F8F9FA' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-14" style={{ color: '#0F172A' }}>
          Numeros Que Hablan
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {[
            { value: '12,312', label: 'Casos Aprobados', borderColor: '#C9A96A' },
            { value: 'Top 3%', label: 'En la industria por tasa de exito', borderColor: '#3B82F6' },
            { value: '6 Meses', label: 'Tiempo promedio de aprobacion', borderColor: '#3B82F6' },
            { value: '24/7', label: 'Soporte especializado incluido', borderColor: '#C9A96A' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-7 text-center transition-all hover:-translate-y-1"
              style={{ borderTop: `4px solid ${s.borderColor}`, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <p className="text-2xl md:text-3xl font-black mb-2" style={{ color: '#C9A96A' }}>{s.value}</p>
              <p className="text-sm" style={{ color: '#64748B' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 3: Nuestra Metodologia ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#FFFFFF' }}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center mb-4" style={{ color: '#0F172A' }}>
          Nuestra Metodologia: No Vendemos Tramites, Construimos Proyectos
        </h2>
        <p className="text-center text-base max-w-2xl mx-auto mb-14" style={{ color: '#64748B' }}>
          Cada caso es analizado, estructurado y documentado como un proyecto de interes nacional legalmente valido.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {[
            {
              icon: FileText,
              title: 'Analisis y Estructuracion',
              items: [
                'Evaluacion profunda de tu perfil profesional',
                'Identificacion del proyecto de interes nacional',
                'Mapeo de todos los requerimientos USCIS',
                'Estrategia de presentacion personalizada',
              ],
            },
            {
              icon: FolderOpen,
              title: 'Documentacion Profesional',
              items: [
                'Business Plan estructurado y profesional',
                'White Paper tecnico de tu especialidad',
                'Estudio econometrico de viabilidad',
                'Analisis de mercado y demanda',
              ],
            },
            {
              icon: Lock,
              title: 'Validacion Legal y Oficial',
              items: [
                'Patente registrada (si aplica)',
                'Certificaciones de innovacion oficial',
                'Cartas de apoyo de expertos en tu sector',
                'Aval de instituciones reconocidas',
              ],
            },
            {
              icon: Brain,
              title: 'Cerebro IA - Especialista en RFE',
              items: [
                'Sistema experto para responder RFEs automaticamente',
                '93.7% de exito en apelaciones',
                'Acompanamiento personalizado en cada RFE',
                'Respuestas tecnicas y legales integradas',
              ],
            },
          ].map((card, i) => (
            <div key={i} className="rounded-xl p-7 transition-all hover:-translate-y-1"
              style={{ background: '#F8F9FA', borderLeft: '4px solid #C9A96A', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-3 mb-5">
                <card.icon className="h-5 w-5" style={{ color: '#C9A96A' }} />
                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{card.title}</h3>
              </div>
              <ul className="space-y-3">
                {card.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm" style={{ color: '#475569' }}>
                    <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#C9A96A' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 4: El Proceso ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#FFFFFF' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-16" style={{ color: '#0F172A' }}>
          El Proceso: 4 Etapas Claras
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { num: '1', title: 'Elegibilidad', desc: 'Reporte completo y ruta personalizada. Sin costo.', size: 'h-16 w-16 text-xl' },
            { num: '2', title: 'Estructuracion', desc: 'Documentacion profesional de tu proyecto.', size: 'h-18 w-18 text-2xl' },
            { num: '3', title: 'Presentacion', desc: 'Radicacion y Premium Processing (15 dias).', size: 'h-20 w-20 text-2xl' },
            { num: '4', title: 'Aprobacion', desc: 'Acompanamiento hasta tu residencia permanente.', size: 'h-22 w-22 text-3xl' },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <div className={`rounded-full flex items-center justify-center font-black mb-5 ${step.size}`}
                style={{ background: '#C9A96A', color: '#FFFFFF', width: 56 + i * 10, height: 56 + i * 10, fontSize: 20 + i * 4 }}>
                {step.num}
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: '#0F172A' }}>{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 5: Casos de Exito ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: '#F1F5F9' }}>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-center mb-14" style={{ color: '#0F172A' }}>
          Casos de Exito Verificados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            {
              name: 'Dr. Carlos M.',
              role: 'Cirujano Cardiologo',
              quote: 'Pense que necesitaba a un empleador. URPE me mostro que mi carrera es mi activo.',
              result: 'Aprobado en 5 meses - Abril 2024',
            },
            {
              name: 'Ing. Eliana L.',
              role: 'Ingeniera de Software Senior',
              quote: 'El Cerebro IA respondio mi RFE en 72 horas. Fue aprobado al primer intento.',
              result: 'Aprobado en 6 meses - Marzo 2024',
            },
            {
              name: 'Javier G.',
              role: 'Emprendedor / Desarrollador de Apps',
              quote: 'Mi app fue reconocida como proyecto de interes nacional. Ahora tengo control total.',
              result: 'Aprobado en 7 meses - Mayo 2024',
            },
          ].map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-7 transition-all hover:-translate-y-1"
              style={{ borderTop: '4px solid #C9A96A', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#0F172A' }}>{t.name}</h3>
              <p className="text-sm font-semibold mb-4" style={{ color: '#C9A96A' }}>{t.role}</p>
              <p className="text-sm italic mb-5 leading-relaxed" style={{ color: '#475569' }}>"{t.quote}"</p>
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#C9A96A' }}>
                <Check className="h-4 w-4" />{t.result}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 6: Primera Etapa Gratis ═══ */}
      <section className="py-20 md:py-28 px-6" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-center mb-4" style={{ color: '#FFFFFF' }}>
          Primera Etapa: Gratis y Sin Obligacion
        </h2>
        <p className="text-center text-base max-w-xl mx-auto mb-14" style={{ color: '#94A3B8' }}>
          Obten tu Reporte de Elegibilidad y Ruta Personalizada. Sabras exactamente donde estas y que viene despues.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mb-12">
          {[
            { icon: FileText, title: 'Reporte Completo', desc: 'Analisis detallado de tu elegibilidad para EB2-NIW' },
            { icon: FolderOpen, title: 'Ruta Personalizada', desc: 'Plan paso a paso para tu aprobacion especifica' },
            { icon: Check, title: 'Sin Costo Inicial', desc: 'Zero risk. No pagas hasta ver resultados.' },
          ].map((c, i) => (
            <div key={i} className="rounded-xl p-7 text-center transition-all hover:-translate-y-1"
              style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(201,169,106,0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex justify-center mb-4">
                <c.icon className="h-6 w-6" style={{ color: '#C9A96A' }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: '#FFFFFF' }}>{c.title}</h3>
              <p className="text-sm" style={{ color: '#94A3B8' }}>{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <button
            data-testid="reporte-gratuito-btn"
            className="px-10 py-4 rounded text-sm font-bold tracking-widest uppercase transition-all hover:scale-105"
            style={{ background: '#C9A96A', color: '#0F172A' }}
          >
            OBTENER MI REPORTE GRATUITO
          </button>
        </div>
      </section>

      {/* ═══ SECTION 7: CTA Final ═══ */}
      <section className="py-20 md:py-28 px-6 text-center" style={{ background: '#FFFFFF' }}>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-5" style={{ color: '#0F172A' }}>
          Listo para Tomar Control?
        </h2>
        <p className="text-base mb-10 max-w-lg mx-auto" style={{ color: '#64748B' }}>
          Las leyes migratorias cambian. Las oportunidades se cierran. El tiempo no espera.
        </p>
        <a
          href="https://wa.me/17315038255?text=Hola%2C%20quiero%20agendar%20mi%20consulta%20estrategica"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="consulta-estrategica-btn"
          className="inline-block px-10 py-4 rounded text-sm font-bold tracking-widest uppercase transition-all hover:scale-105 mb-5"
          style={{ background: '#0F172A', color: '#FFFFFF' }}
        >
          AGENDA TU CONSULTA ESTRATEGICA
        </a>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Plazas limitadas para abril. Consultoria profesional incluida en tu evaluacion inicial.
        </p>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-10 px-6 text-center" style={{ background: '#0F172A', borderTop: '1px solid #1E293B' }}>
        <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>
          &copy; 2026 URPE Integral Services. Todos los derechos reservados.
        </p>
        <p className="text-xs" style={{ color: '#64748B' }}>
          Especialistas en EB2-NIW, Asilo, y Peticiones Familiares | 14 anos de excelencia migratoria
        </p>
      </footer>
    </div>
  );
}
