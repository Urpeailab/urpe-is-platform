# Arquitectura del Frontend - URPE Integral Services

## 📦 Stack Tecnológico

### Core
- **React 19.0.0** - Framework principal
- **React Router DOM 7.5.1** - Navegación y rutas
- **Axios 1.8.4** - HTTP client para API calls
- **i18next + react-i18next** - Internacionalización (ES/EN)

### UI Framework & Components
- **Tailwind CSS 3.4.17** - Framework de estilos utility-first
- **Shadcn UI** - Biblioteca de componentes (basada en Radix UI)
- **Radix UI** - Componentes primitivos accesibles (30+ componentes)
- **Lucide React 0.507** - Biblioteca de íconos
- **class-variance-authority** - Gestión de variantes de componentes
- **clsx + tailwind-merge** - Utilidades para clases CSS

### State Management & Forms
- **React Context API** - Gestión de estado global (AuthContext)
- **React Hook Form 7.56** - Manejo de formularios
- **Zod 3.24** - Validación de esquemas

### Utilities & Features
- **html2canvas + jsPDF** - Generación de PDFs
- **Sonner** - Sistema de notificaciones toast
- **date-fns** - Manipulación de fechas
- **embla-carousel-react** - Carruseles
- **next-themes** - Gestión de temas (dark/light mode ready)

---

## 🗂️ Estructura de Carpetas

```
/app/frontend/
├── public/
│   └── index.html                    # HTML base
│
├── src/
│   ├── index.js                      # Entry point
│   ├── App.js                        # Main App component con rutas
│   ├── App.css                       # Estilos globales
│   ├── index.css                     # Tailwind imports + animaciones custom
│   ├── i18n.js                       # Configuración i18next (715 keys ES/EN)
│   │
│   ├── components/                   # Componentes reutilizables
│   │   ├── Navbar.js                 # Navegación principal (público)
│   │   ├── MonicaChat.js             # Chat flotante con asesora
│   │   ├── EligibilityReport.js     # Reporte de elegibilidad (traducido)
│   │   ├── AdvisorProfile.js         # Perfil de asesora asignada
│   │   ├── WelcomeVideoModal.js      # Modal de video one-time
│   │   └── ui/                       # Shadcn UI components (40+ archivos)
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── input.jsx
│   │       ├── dialog.jsx
│   │       ├── tabs.jsx
│   │       ├── badge.jsx
│   │       ├── dropdown-menu.jsx
│   │       ├── scroll-area.jsx
│   │       ├── separator.jsx
│   │       └── ... (30+ más)
│   │
│   ├── contexts/                     # React Context providers
│   │   └── AuthContext.js            # Autenticación de usuarios
│   │
│   ├── hooks/                        # Custom hooks
│   │   └── use-toast.js              # Hook para notificaciones
│   │
│   ├── layouts/                      # Layouts compartidos
│   │   └── DashboardLayout.js        # Layout del dashboard con sidebar
│   │
│   ├── pages/                        # Páginas de la aplicación
│   │   ├── Home.js                   # Landing page pública
│   │   ├── About.js                  # Sobre nosotros
│   │   ├── Eligibility.js            # Check de elegibilidad (con loading)
│   │   ├── Auth.js                   # Login/Registro
│   │   ├── Panel.js                  # Panel anterior (legacy)
│   │   ├── Messages.js               # Mensajes públicos
│   │   │
│   │   └── dashboard/                # Páginas del dashboard (protegidas)
│   │       ├── DashboardHome.js      # Home del dashboard
│   │       ├── EligibilityReportPage.js  # Página del reporte
│   │       ├── Appointments.js       # Citas
│   │       ├── DashboardMessages.js  # Mensajes internos
│   │       ├── WebinarsPage.js       # Webinars (upcoming + recorded)
│   │       ├── LegalLibraryPage.js   # Biblioteca legal
│   │       ├── SuccessCalculatorPage.js  # Calculadora de éxito
│   │       ├── SuccessStoriesPage.js # Casos de éxito
│   │       ├── ComparatorPage.js     # Comparador "Personas como Tú"
│   │       ├── TimelinePredictorPage.js  # Timeline personalizado
│   │       └── DocumentationPackagePage.js  # 15 servicios de URPE
│   │
│   ├── utils/                        # Utilidades
│   │   └── pdfGenerator.js           # Generación de PDF del reporte
│   │
│   └── lib/                          # Librerías auxiliares
│       └── utils.js                  # Utility functions (cn, etc.)
│
├── tailwind.config.js                # Configuración de Tailwind
├── postcss.config.js                 # PostCSS config
├── components.json                   # Config de Shadcn UI
├── craco.config.js                   # CRACO overrides
└── package.json                      # Dependencies
```

---

## 🎨 Sistema de Diseño

### Paleta de Colores (Brand URPE)
```css
/* Colores principales */
--primary: #FFC700 (Yellow 500)    /* Amarillo URPE */
--background: #000000 (Black)       /* Fondo principal */
--foreground: #FFFFFF (White)       /* Texto principal */

/* Colores secundarios */
--accent: #FFC700                   /* Amarillo */
--muted: #333333                    /* Gris oscuro */
--border: #FFC700                   /* Bordes amarillos */

/* Estados */
--success: #22C55E (Green 500)
--error: #EF4444 (Red 500)
--warning: #F59E0B (Amber 500)
--info: #3B82F6 (Blue 500)
```

### Tipografía
```css
/* Fuentes */
Primary: 'Inter' (body text, UI)
Heading: 'Manrope' (títulos, destacados)
Mono: 'Monaco', 'Courier New' (códigos, números)
```

### Espaciado y Medidas
- **Container max-width**: `max-w-7xl` (1280px)
- **Sidebar width**: `w-64` (256px)
- **Navbar height**: `h-16` (64px)
- **Border radius**: `rounded-lg` (0.5rem)
- **Spacing scale**: Tailwind default (4px base)

### Componentes UI Disponibles (Shadcn/Radix)
```
✅ accordion         ✅ alert-dialog      ✅ alert
✅ avatar           ✅ badge             ✅ breadcrumb
✅ button           ✅ calendar          ✅ card
✅ carousel         ✅ checkbox          ✅ collapsible
✅ command          ✅ context-menu      ✅ dialog
✅ drawer           ✅ dropdown-menu     ✅ form
✅ hover-card       ✅ input             ✅ label
✅ menubar          ✅ navigation-menu   ✅ pagination
✅ popover          ✅ progress          ✅ radio-group
✅ scroll-area      ✅ select            ✅ separator
✅ sheet            ✅ skeleton          ✅ slider
✅ sonner (toast)   ✅ switch            ✅ table
✅ tabs             ✅ textarea          ✅ toggle
✅ tooltip          ✅ resizable-panels
```

---

## 🛣️ Sistema de Rutas

### Rutas Públicas (No requieren auth)
```javascript
/                    → Home (Landing page)
/about              → About Us
/eligibility        → Check Eligibility (con loading screen)
/auth               → Login/Register
/messages           → Mensajes públicos
```

### Rutas Protegidas (Dashboard)
```javascript
/dashboard                    → Dashboard Home
/dashboard/eligibility-report → Reporte de Elegibilidad
/dashboard/appointments       → Citas
/dashboard/messages          → Mensajes
/dashboard/webinars          → Webinars y Eventos
/dashboard/legal-library     → Biblioteca Legal
/dashboard/success-calculator → Calculadora de Éxito
/dashboard/success-stories   → Casos de Éxito Personalizados
/dashboard/comparator        → Comparador "Personas como Tú"
/dashboard/timeline-predictor → Timeline Personalizado
/dashboard/documentation-package → 15 Servicios de URPE
```

### Componente de Protección de Rutas
```javascript
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/auth" />;
};
```

---

## 🔐 Gestión de Estado

### AuthContext
```javascript
// Proveedor de autenticación global
<AuthProvider>
  {
    user: {
      id, phone, email, name, profession,
      eligible, userState, advisor, report
    },
    loading: boolean,
    updateUser: (userData) => void,
    signOut: () => void
  }
</AuthProvider>

// Uso en componentes
const { user, loading, updateUser, signOut } = useAuth();
```

### Local Storage
```javascript
// Almacenamiento de sesión
localStorage.setItem('urpe_user', JSON.stringify(user));
localStorage.getItem('urpe_user');
```

---

## 🌍 Internacionalización (i18n)

### Configuración
- **Idiomas soportados**: Español (es), Inglés (en)
- **Detección automática**: Navegador + localStorage
- **715 claves de traducción** por idioma
- **Cambio dinámico**: Sin reload de página

### Uso en Componentes
```javascript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <button onClick={() => i18n.changeLanguage('es')}>
        Español
      </button>
    </div>
  );
}
```

### Estructura de Claves
```javascript
{
  // Navegación
  "nav.home": "Home" / "Inicio",
  "nav.about": "About Us" / "Sobre Nosotros",
  
  // Dashboard
  "dashboard.nav.home": "Home" / "Inicio",
  "dashboard.nav.eligibility": "Eligibility" / "Elegibilidad",
  
  // Reportes dinámicos
  "reportContent.user001.nationalInterest.title": "...",
  "reportContent.user002.patent.description": "...",
  
  // Loading screens
  "eligibility.loading.step1": "Verifying..." / "Verificando...",
  "dashboard.loading": "Loading..." / "Cargando...",
}
```

---

## 🎭 Componentes Principales

### 1. Navbar (Público)
```javascript
// Navegación principal del sitio público
<Navbar />
- Logo URPE
- Links: Home, About, Eligibility
- Language toggle (ES/EN)
- Sticky top, backdrop blur
```

### 2. DashboardLayout
```javascript
// Layout del dashboard con sidebar
<DashboardLayout>
  {children}
</DashboardLayout>

Features:
- Sidebar colapsable (mobile/desktop)
- Top bar con user info
- Language switcher
- Notifications bell
- User dropdown menu
- Loading overlay en navegación (con logo animado)
- Menu items con badges (client/prospect)
- Permisos por rol
```

### 3. EligibilityReport
```javascript
// Reporte de elegibilidad personalizado
<EligibilityReport report={report} />

Secciones:
- National Interest Project
- Recommended Patent
- Book Publication Strategy
- Mobile App Development
- Strategic Recommendations
- Immediate Next Steps
- Advisor Profile

Features:
- Totalmente traducido (dinámico)
- PDF download con botón
- Iconos por sección
- Cards con bordes amarillos
- ScrollArea para listas largas
```

### 4. MonicaChat
```javascript
// Chat flotante con asesora
<MonicaChat />

Features:
- Botón flotante (fixed bottom-right)
- Modal expandible
- Avatar de asesora asignada
- Quick actions
- Minimizable
- Z-index alto (z-50)
```

### 5. WelcomeVideoModal
```javascript
// Video de bienvenida one-time
<WelcomeVideoModal />

Features:
- Solo se muestra una vez
- Video embebido
- Botón de cerrar
- Marca como visto en DB
- Full screen overlay
```

---

## 🎬 Animaciones

### CSS Personalizadas
```css
/* Loading screen animations */
@keyframes scale-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Clases */
.animate-scale-in { animation: scale-in 0.5s ease-out; }
.animate-fade-in { animation: fade-in 0.3s ease-out; }
.animate-bounce-slow { animation: bounce-slow 2s infinite; }
```

### Tailwind Animate
```javascript
// Configurado en tailwind.config.js
animate-spin, animate-pulse, animate-bounce
```

### Loading Screens

**Eligibility Check (3 segundos):**
```
1. Verifying phone number... (0s)
2. Searching database... (0.8s)
3. Loading profile... (1.6s)
4. Preparing dashboard... (2.4s)
5. Welcome back! (3s+) → Redirect
```

**Dashboard Navigation (1 segundo):**
```
- Logo URPE con bounce suave
- Círculo amarillo pulsante
- 3 dots animados
- Texto "Cargando..."
- Full screen overlay
```

---

## 📱 Responsive Design

### Breakpoints (Tailwind)
```javascript
sm: '640px'   // Tablet pequeño
md: '768px'   // Tablet
lg: '1024px'  // Desktop pequeño
xl: '1280px'  // Desktop
2xl: '1536px' // Desktop grande
```

### Patrones Responsive
```javascript
// Sidebar colapsable
<div className="lg:block hidden"> // Desktop solo
<div className="lg:hidden block"> // Mobile solo

// Grid adaptativo
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// Espaciado responsive
<div className="px-4 md:px-6 lg:px-8">

// Tipografía responsive
<h1 className="text-2xl md:text-3xl lg:text-4xl">
```

---

## 🔌 Integración con Backend

### API Configuration
```javascript
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Axios instance (opcional)
import axios from 'axios';

// Ejemplo de llamada
const response = await axios.post(`${API}/eligibility/check-phone`, {
  phone,
  language: i18n.language
});
```

### Endpoints Consumidos (Usuario)
```javascript
POST /api/eligibility/check-phone      // Verificar usuario
GET  /api/user/profile                 // Perfil del usuario
GET  /api/user/report                  // Reporte de elegibilidad
GET  /api/comparator/:userId           // Casos similares
GET  /api/timeline/:userId             // Timeline personalizado
GET  /api/webinars                     // Lista de webinars
POST /api/webinars/:id/register        // Registrarse a webinar
GET  /api/legal-documents              // Biblioteca legal
GET  /api/advisor/:id                  // Info de asesora
```

---

## 🧪 Testing Ready

### Test IDs en Componentes
```javascript
// Ejemplos de data-testid para testing
data-testid="phone-input"
data-testid="check-eligibility-button"
data-testid="report-title"
data-testid="nav-dashboard"
data-testid="menu-toggle"
```

---

## ⚡ Performance

### Optimizaciones Implementadas
- **Lazy Loading**: Componentes grandes pueden ser lazy-loaded
- **Code Splitting**: Routes automáticamente code-splitted
- **Image Optimization**: CDN para logos y recursos
- **Memoization**: useCallback y useMemo donde necesario
- **Virtual Scrolling**: ScrollArea de Radix en listas largas

### Bundle Size
```
React + ReactDOM: ~140KB
UI Components: ~100KB
Icons: ~50KB
i18n: ~30KB
Total (gzipped): ~320KB aproximadamente
```

---

## 🚀 Deployment

### Build Process
```bash
yarn build
# Genera /build con:
# - HTML, CSS, JS minificados
# - Assets optimizados
# - Source maps
```

### Environment Variables
```bash
REACT_APP_BACKEND_URL=https://api.urpe.com
# Usado en todo el frontend para API calls
```

---

## 📝 Convenciones de Código

### Naming Conventions
```javascript
// Componentes: PascalCase
function DashboardHome() {}

// Hooks: camelCase con use prefix
function useAuth() {}

// Utilities: camelCase
function formatDate() {}

// Constantes: UPPER_SNAKE_CASE
const API_BASE_URL = '...';
```

### File Organization
```javascript
// Un componente por archivo
// Nombre del archivo = Nombre del componente
DashboardHome.js → export const DashboardHome
```

### Imports Order
```javascript
// 1. React
import React, { useState } from 'react';

// 2. External libraries
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// 3. Internal components
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';

// 4. Contexts & hooks
import { useAuth } from '@/contexts/AuthContext';

// 5. Utils & constants
import { cn } from '@/lib/utils';
```

---

## 🎯 Próximos Pasos para Admin Panel

### Nuevas Carpetas Necesarias
```
src/
├── admin/                        # TODO: Nueva carpeta admin
│   ├── components/              # Componentes exclusivos del admin
│   ├── pages/                   # Páginas del admin panel
│   ├── layouts/                 # AdminLayout
│   └── contexts/                # AdminAuthContext
```

### Rutas Nuevas
```javascript
/admin/login                     # TODO: Login de admin
/admin/dashboard                 # TODO: Dashboard admin
/admin/users                     # TODO: Gestión de usuarios
/admin/templates                 # TODO: Templates
// etc...
```

### Consideraciones
- Autenticación separada (JWT)
- Permisos por rol
- UI más densa (tablas, filtros, acciones bulk)
- Exportación de datos
- Upload de archivos
- WYSIWYG editors (para templates)

---

## 📚 Recursos y Documentación

- **Tailwind CSS**: https://tailwindcss.com/docs
- **Shadcn UI**: https://ui.shadcn.com
- **Radix UI**: https://www.radix-ui.com
- **React Router**: https://reactrouter.com
- **i18next**: https://www.i18next.com
- **Lucide Icons**: https://lucide.dev

---

**Última actualización**: Noviembre 2025
**Versión Frontend**: 0.1.0
**React Version**: 19.0.0
