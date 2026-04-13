import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Landing Page
      "landing.title": "Monica",
      "landing.subtitle": "AI-Powered Professional Document Generator",
      "landing.description": "Create National Interest Projects for NIW applications, USPTO patents, complete books, technical white papers, econometric studies, and specialized letters with advanced artificial intelligence",
      "landing.getStarted": "Get Started",
      "landing.login": "Login",
      "landing.features.title": "Complete Document Suite",
      "landing.features.subtitle": "Active Features",
      "landing.features.niw": "National Interest Projects (NIW)",
      "landing.features.niw.desc": "Professional documents for National Interest Projects aligned with USCIS requirements for EB-2 NIW applications",
      "landing.features.patents": "USPTO Patents",
      "landing.features.patents.desc": "Complete provisional patent applications with technical drawings (FIG. 1-7), claims, and USPTO specifications",
      "landing.features.books": "Complete Books",
      "landing.features.books.desc": "Write full-length books with structured chapters, narratives, and professional formatting",
      "landing.features.whitepapers": "Technical White Papers",
      "landing.features.whitepapers.desc": "Professional 16-section technical documents with advanced analysis",
      "landing.features.econometric": "Econometric Studies",
      "landing.features.econometric.desc": "Rigorous 16-section analysis for National Interest Projects with statistical models, quantifiable benefits, and data visualization",
      "landing.comingsoon.title": "Coming Soon",
      "landing.comingsoon.casestudies": "Business Case Studies",
      "landing.comingsoon.casestudies.desc": "Detailed business case analysis",
      "landing.comingsoon.policy": "Social Impact Reports",
      "landing.comingsoon.policy.desc": "Policy papers with social impact focus",
      "landing.comingsoon.selfpetition": "Self-Petition Letters",
      "landing.comingsoon.selfpetition.desc": "Professional self-petition letters",
      "landing.comingsoon.recommendation": "Recommendation Letters",
      "landing.comingsoon.recommendation.desc": "Personalized recommendation letters",
      "landing.comingsoon.expert": "Expert Letters",
      "landing.comingsoon.expert.desc": "Expert opinion letters",
      
      // Auth
      "auth.register": "Register",
      "auth.login": "Login",
      "auth.logout": "Logout",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.fullName": "Full Name",
      "auth.languagePreference": "Language Preference",
      "auth.alreadyAccount": "Already have an account?",
      "auth.noAccount": "Don't have an account?",
      "auth.signIn": "Sign In",
      "auth.signUp": "Sign Up",
      
      // Dashboard
      "dashboard.businessPlans": "Business Plans",
      "dashboard.books": "Books",
      "dashboard.graphicDesign": "Graphic Design",
      "dashboard.myPlans": "My Business Plans",
      "dashboard.myBooks": "My Books",
      "dashboard.designedDocs": "Graphic Design Documents",
      "dashboard.createPlan": "Create Plan",
      "dashboard.createBook": "Create Book",
      "dashboard.designDocument": "Design Document",
      "dashboard.noPlanst": "No plans created",
      "dashboard.noBooks": "No books created",
      "dashboard.noDocs": "No documents designed",
      "dashboard.loading": "Loading...",
      
      // Forms
      "form.businessName": "Business Name",
      "form.industry": "Industry",
      "form.description": "Description",
      "form.targetMarket": "Target Market",
      "form.funding": "Funding Needed",
      "form.language": "Content Language",
      "form.applyDesign": "Apply graphic design",
      "form.designDesc": "Design Description",
      "form.bookTitle": "Book Title",
      "form.genre": "Genre",
      "form.synopsis": "Synopsis",
      "form.chapters": "Number of Chapters",
      "form.writingStyle": "Writing Style",
      "form.uploadFile": "Upload Document",
      "form.summarize": "Summarize content",
      "form.generate": "Generate",
      "form.back": "Back",
      "form.save": "Save",
      "form.download": "Download PDF",
      "form.edit": "View/Edit",
      "form.delete": "Delete",
      
      // Common
      "common.spanish": "Spanish",
      "common.english": "English",
      "common.professional": "Professional",
      "common.casual": "Casual",
      "common.academic": "Academic",
      "common.narrative": "Narrative",
      "common.poetic": "Poetic",
      "common.summarized": "Summarized",
      "common.complete": "Complete"
    }
  },
  es: {
    translation: {
      // Landing Page
      "landing.title": "Monica",
      "landing.subtitle": "Generador Profesional de Documentos con IA",
      "landing.description": "Crea Proyectos de Interés Nacional para solicitudes NIW, patentes USPTO, libros completos, white papers técnicos, estudios econométricos y cartas especializadas con inteligencia artificial avanzada",
      "landing.getStarted": "Comenzar",
      "landing.login": "Iniciar Sesión",
      "landing.features.title": "Suite Completa de Documentos",
      "landing.features.subtitle": "Funcionalidades Activas",
      "landing.features.niw": "Proyectos de Interés Nacional (NIW)",
      "landing.features.niw.desc": "Documentos profesionales para Proyectos de Interés Nacional alineados con requisitos de USCIS para solicitudes EB-2 NIW",
      "landing.features.patents": "Patentes USPTO",
      "landing.features.patents.desc": "Aplicaciones provisionales completas con dibujos técnicos (FIG. 1-7), claims y especificaciones USPTO",
      "landing.features.books": "Libros Completos",
      "landing.features.books.desc": "Escribe libros extensos con capítulos estructurados, narrativas y formato profesional",
      "landing.features.whitepapers": "White Papers Técnicos",
      "landing.features.whitepapers.desc": "Documentos técnicos profesionales de 16 secciones con análisis avanzado",
      "landing.features.econometric": "Estudios Econométricos",
      "landing.features.econometric.desc": "Análisis riguroso de 16 secciones para Proyectos de Interés Nacional con modelos estadísticos, beneficios cuantificables y visualización de datos",
      "landing.comingsoon.title": "Próximamente",
      "landing.comingsoon.casestudies": "Casos de Estudio Empresariales",
      "landing.comingsoon.casestudies.desc": "Análisis detallados de casos de negocio",
      "landing.comingsoon.policy": "Reportes de Impacto Social",
      "landing.comingsoon.policy.desc": "Policy papers con enfoque de impacto social",
      "landing.comingsoon.selfpetition": "Cartas de Autopetición",
      "landing.comingsoon.selfpetition.desc": "Cartas profesionales de autopetición",
      "landing.comingsoon.recommendation": "Cartas de Recomendación",
      "landing.comingsoon.recommendation.desc": "Cartas personalizadas de recomendación",
      "landing.comingsoon.expert": "Cartas de Expertos",
      "landing.comingsoon.expert.desc": "Cartas de opinión de expertos",
      
      // Auth
      "auth.register": "Registrarse",
      "auth.login": "Iniciar Sesión",
      "auth.logout": "Cerrar Sesión",
      "auth.email": "Correo Electrónico",
      "auth.password": "Contraseña",
      "auth.fullName": "Nombre Completo",
      "auth.languagePreference": "Idioma Preferido",
      "auth.alreadyAccount": "¿Ya tienes cuenta?",
      "auth.noAccount": "¿No tienes cuenta?",
      "auth.signIn": "Ingresar",
      "auth.signUp": "Registrarse",
      
      // Dashboard
      "dashboard.businessPlans": "Planes de Negocios",
      "dashboard.books": "Libros",
      "dashboard.graphicDesign": "Diseño Gráfico",
      "dashboard.myPlans": "Mis Planes de Negocios",
      "dashboard.myBooks": "Mis Libros",
      "dashboard.designedDocs": "Documentos de Diseño Gráfico",
      "dashboard.createPlan": "Crear Plan",
      "dashboard.createBook": "Crear Libro",
      "dashboard.designDocument": "Diseñar Documento",
      "dashboard.noPlans": "No hay planes creados",
      "dashboard.noBooks": "No hay libros creados",
      "dashboard.noDocs": "No hay documentos diseñados",
      "dashboard.loading": "Cargando...",
      
      // Forms
      "form.businessName": "Nombre del Negocio",
      "form.industry": "Industria",
      "form.description": "Descripción",
      "form.targetMarket": "Mercado Objetivo",
      "form.funding": "Financiamiento Necesario",
      "form.language": "Idioma del Contenido",
      "form.applyDesign": "Aplicar diseño gráfico",
      "form.designDesc": "Descripción del Diseño",
      "form.bookTitle": "Título del Libro",
      "form.genre": "Género",
      "form.synopsis": "Sinopsis",
      "form.chapters": "Número de Capítulos",
      "form.writingStyle": "Estilo de Escritura",
      "form.uploadFile": "Subir Documento",
      "form.summarize": "Resumir contenido",
      "form.generate": "Generar",
      "form.back": "Volver",
      "form.save": "Guardar",
      "form.download": "Descargar PDF",
      "form.edit": "Ver/Editar",
      "form.delete": "Eliminar",
      
      // Common
      "common.spanish": "Español",
      "common.english": "Inglés",
      "common.professional": "Profesional",
      "common.casual": "Casual",
      "common.academic": "Académico",
      "common.narrative": "Narrativo",
      "common.poetic": "Poético",
      "common.summarized": "Resumido",
      "common.complete": "Completo"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'es',
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;