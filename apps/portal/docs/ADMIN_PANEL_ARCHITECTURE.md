# Arquitectura del Panel Administrativo - URPE Integral Services

## 1. SISTEMA DE ROLES Y PERMISOS

### Jerarquía de Roles
```
Super Admin (Nivel 1)
├── Admin (Nivel 2)
├── Gerente (Nivel 3)
│   ├── Coordinador (Nivel 4)
│   │   └── Asesor (Nivel 5)
```

### Matriz de Permisos

| Módulo | Super Admin | Admin | Gerente | Coordinador | Asesor |
|--------|-------------|-------|---------|-------------|---------|
| **Gestión de Staff** |
| Crear/editar/eliminar staff | ✅ | ✅ | Ver solo | ❌ | ❌ |
| Asignar roles | ✅ | ✅ (excepto Super Admin) | ❌ | ❌ | ❌ |
| **Gestión de Usuarios (Clientes)** |
| Ver todos los usuarios | ✅ | ✅ | ✅ | Ver asignados | Ver asignados |
| Crear/editar usuarios | ✅ | ✅ | ✅ | ✅ | Ver solo |
| Eliminar usuarios | ✅ | ✅ | ❌ | ❌ | ❌ |
| Cambiar estado | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Reportes de Elegibilidad** |
| Crear templates | ✅ | ✅ | ✅ | Ver solo | Ver solo |
| Asignar templates a usuarios | ✅ | ✅ | ✅ | ✅ | Ver asignados |
| Editar reportes asignados | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Asesoras** |
| Crear/editar perfiles de asesoras | ✅ | ✅ | Ver solo | Ver solo | Ver solo |
| Asignar asesoras a usuarios | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Webinars y Eventos** |
| Crear/editar/eliminar | ✅ | ✅ | ✅ | Ver solo | Ver solo |
| Ver registros | ✅ | ✅ | ✅ | ✅ | Ver asignados |
| **Biblioteca Legal** |
| Subir documentos | ✅ | ✅ | ✅ | Ver solo | Ver solo |
| Categorizar documentos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Eliminar documentos | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Comparador** |
| Crear/editar casos | ✅ | ✅ | ✅ | Ver solo | Ver solo |
| Eliminar casos | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Timeline** |
| Editar etapas globales | ✅ | ✅ | Ver solo | Ver solo | Ver solo |
| Personalizar timeline por usuario | ✅ | ✅ | ✅ | ✅ | Ver asignados |
| **Video de Bienvenida** |
| Subir/cambiar video | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Exportación de Datos** |
| Exportar todo | ✅ | ✅ | Solo su equipo | Solo asignados | Solo asignados |
| **Estadísticas** |
| Ver dashboard completo | ✅ | ✅ | ✅ | Ver equipo | Ver asignados |

---

## 2. ESTRUCTURA DE BASE DE DATOS (MongoDB)

### Colección: `staff`
```javascript
{
  _id: UUID,
  email: String (unique),
  name: String,
  role: String, // "super_admin", "admin", "manager", "coordinator", "advisor"
  roleLevel: Number, // 1-5
  phone: String,
  photo: String, // URL
  status: String, // "active", "inactive", "suspended"
  permissions: {
    canManageStaff: Boolean,
    canManageUsers: Boolean,
    canManageContent: Boolean,
    canExportData: Boolean,
    canManageFinances: Boolean,
    customPermissions: [String] // permisos específicos
  },
  managedBy: UUID, // ID del gerente que supervisa (null para super_admin)
  teamMembers: [UUID], // IDs de coordinadores/asesores bajo su cargo
  createdAt: Date,
  updatedAt: Date,
  lastLogin: Date,
  magicLinkToken: String,
  magicLinkExpires: Date,
  passwordHash: String // bcrypt
}
```

### Colección: `users` (Clientes - ACTUALIZADA)
```javascript
{
  _id: UUID,
  phone: String (unique),
  email: String,
  name: String,
  profession: String,
  eligible: Boolean,
  userState: String, // "U1", "U2", "U3"
  
  // Nueva: Asesor asignado
  assignedAdvisor: {
    id: UUID, // ref a advisors
    assignedAt: Date,
    assignedBy: UUID // ref a staff
  },
  
  // Nueva: Reporte personalizado
  eligibilityReport: {
    templateId: UUID, // ref a eligibility_templates
    customContent: Object, // contenido personalizado del reporte
    lastUpdatedBy: UUID, // ref a staff
    lastUpdatedAt: Date
  },
  
  // Nueva: Video de bienvenida personalizado (opcional)
  welcomeVideo: {
    url: String,
    viewed: Boolean,
    viewedAt: Date
  },
  
  // Nueva: Timeline personalizado
  customTimeline: {
    templateId: UUID, // ref a timeline_templates
    customStages: [Object],
    lastUpdatedBy: UUID,
    lastUpdatedAt: Date
  },
  
  createdAt: Date,
  updatedAt: Date,
  language: String, // "en", "es"
  tags: [String], // para filtrado
  notes: [{ // notas internas del staff
    text: String,
    createdBy: UUID,
    createdAt: Date
  }]
}
```

### Colección: `eligibility_templates`
```javascript
{
  _id: UUID,
  name: String, // "Software Engineer Template", "Medical Doctor Template"
  profession: String,
  language: String, // "en", "es", "both"
  
  // Contenido del template
  content: {
    nationalInterestProject: {
      titleKey: String, // translation key o texto directo
      descriptionKey: String,
      impactKey: String
    },
    patent: {
      titleKey: String,
      descriptionKey: String,
      usptoDraftKey: String
    },
    book: {
      titleKey: String,
      descriptionKey: String,
      chapters: [String] // array de keys o textos
    },
    mobileApp: {
      nameKey: String,
      descriptionKey: String,
      platformsKey: String,
      features: [String]
    },
    recommendations: [String],
    nextSteps: [String]
  },
  
  createdBy: UUID, // ref a staff
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean,
  usageCount: Number // cuántos usuarios usan este template
}
```

### Colección: `advisors`
```javascript
{
  _id: UUID,
  name: String,
  email: String,
  phone: String,
  photo: String, // URL de foto de perfil
  title: String, // "Senior Immigration Advisor", "Founder & CEO"
  bio: {
    en: String,
    es: String
  },
  specialties: [String], // ["EB-2 NIW", "Asylum Cases", "Family Immigration"]
  experience: {
    years: Number,
    clientsHelped: Number
  },
  availability: String, // "available", "busy", "vacation"
  assignedUsers: [UUID], // IDs de usuarios asignados
  
  // Estadísticas
  stats: {
    totalCases: Number,
    activeCases: Number,
    successRate: Number,
    averageResponseTime: Number // en horas
  },
  
  createdBy: UUID,
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
}
```

### Colección: `webinars`
```javascript
{
  _id: UUID,
  title: {
    en: String,
    es: String
  },
  description: {
    en: String,
    es: String
  },
  type: String, // "upcoming", "recorded"
  
  // Para upcoming
  date: Date,
  time: String,
  duration: Number, // minutos
  capacity: Number,
  registeredCount: Number,
  registeredUsers: [UUID], // refs a users
  meetingLink: String,
  
  // Para recorded
  videoUrl: String, // YouTube, Vimeo, o URL directa
  thumbnail: String,
  views: Number,
  rating: Number, // 1-5
  
  // Común
  presenter: {
    name: String,
    title: String,
    photo: String
  },
  level: String, // "beginner", "intermediate", "advanced"
  topics: [String],
  language: String, // "en", "es", "both"
  
  createdBy: UUID,
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
}
```

### Colección: `legal_documents`
```javascript
{
  _id: UUID,
  title: {
    en: String,
    es: String
  },
  description: {
    en: String,
    es: String
  },
  category: String, // "visa_types", "forms", "guides", "regulations", "faqs"
  subcategory: String, // "eb2_niw", "asylum", "family_immigration"
  
  fileUrl: String, // S3 o storage URL
  fileType: String, // "pdf", "docx", "video", "link"
  fileSize: Number, // en bytes
  
  tags: [String],
  language: String,
  
  // Metadata
  downloads: Number,
  views: Number,
  isPremium: Boolean, // solo para clientes
  
  uploadedBy: UUID,
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
}
```

### Colección: `comparator_cases`
```javascript
{
  _id: UUID,
  country: String,
  profession: String,
  visaType: String, // "EB-2 NIW", "Asylum", etc.
  
  profile: {
    education: String,
    experience: Number, // años
    patents: Number,
    publications: Number,
    citations: Number,
    awards: Number
  },
  
  outcome: {
    status: String, // "approved", "pending", "denied"
    processingTime: Number, // meses
    successRate: Number, // porcentaje
  },
  
  timeline: [{
    stage: String,
    duration: Number,
    date: Date
  }],
  
  isActive: Boolean,
  createdBy: UUID,
  createdAt: Date,
  updatedAt: Date
}
```

### Colección: `timeline_templates`
```javascript
{
  _id: UUID,
  name: String, // "Green Card - Standard Process", "Filing Only"
  description: String,
  processType: String, // "green_card", "asylum", "family_petition"
  
  stages: [{
    id: Number,
    name: {
      en: String,
      es: String
    },
    description: {
      en: String,
      es: String
    },
    duration: Number, // días
    durationUnit: String, // "days", "months"
    services: [{ // servicios incluidos en esta etapa
      id: String,
      name: {
        en: String,
        es: String
      },
      duration: Number,
      durationUnit: String
    }],
    optional: Boolean,
    probability: Number // % probabilidad de ocurrir (ej: RFE 25%)
  }],
  
  prediction: {
    estimatedTotalMonths: Number,
    bestCaseMonths: Number,
    worstCaseMonths: Number,
    confidenceLevel: Number
  },
  
  factors: {
    positive: [String],
    considerations: [String]
  },
  
  createdBy: UUID,
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean,
  isDefault: Boolean
}
```

### Colección: `welcome_videos`
```javascript
{
  _id: UUID,
  title: String,
  description: String,
  videoUrl: String, // URL del archivo subido
  thumbnail: String,
  duration: Number, // segundos
  language: String, // "en", "es", "both"
  
  // Metadata
  fileSize: Number,
  uploadedBy: UUID,
  uploadedAt: Date,
  
  isActive: Boolean,
  isDefault: Boolean, // video por defecto para todos los usuarios
  
  // Estadísticas
  views: Number,
  averageWatchTime: Number
}
```

### Colección: `activity_log`
```javascript
{
  _id: UUID,
  staffId: UUID, // quién realizó la acción
  action: String, // "create", "update", "delete", "assign", "export"
  resource: String, // "user", "webinar", "template", "document"
  resourceId: UUID,
  details: Object, // cambios específicos
  ipAddress: String,
  timestamp: Date
}
```

### Colección: `exports`
```javascript
{
  _id: UUID,
  requestedBy: UUID, // staff ID
  type: String, // "users", "webinars", "statistics", "full"
  format: String, // "csv", "excel", "json", "pdf"
  filters: Object, // filtros aplicados
  status: String, // "pending", "processing", "completed", "failed"
  fileUrl: String, // URL del archivo generado
  expiresAt: Date, // auto-eliminar después de 7 días
  createdAt: Date
}
```

---

## 3. ARQUITECTURA FRONTEND - RUTAS DEL ADMIN PANEL

```
/admin
├── /login                          # Login de admin (email/password o magic link)
├── /magic-link/:token             # Procesar magic link
│
├── /dashboard                     # Dashboard principal con estadísticas
│
├── /users                         # Gestión de usuarios (clientes)
│   ├── /                          # Lista de usuarios con filtros
│   ├── /create                    # Crear nuevo usuario
│   ├── /:userId                   # Ver detalles de usuario
│   ├── /:userId/edit              # Editar usuario
│   ├── /:userId/report            # Asignar/editar reporte de elegibilidad
│   └── /:userId/assign-advisor    # Asignar asesor
│
├── /staff                         # Gestión de staff
│   ├── /                          # Lista de staff
│   ├── /create                    # Crear nuevo staff
│   ├── /:staffId                  # Ver detalles
│   ├── /:staffId/edit             # Editar staff
│   └── /roles                     # Configuración de roles y permisos
│
├── /templates                     # Templates de reportes de elegibilidad
│   ├── /                          # Lista de templates
│   ├── /create                    # Crear template
│   ├── /:templateId               # Ver template
│   └── /:templateId/edit          # Editar template
│
├── /advisors                      # Gestión de asesoras
│   ├── /                          # Lista de asesoras
│   ├── /create                    # Crear perfil de asesora
│   ├── /:advisorId                # Ver perfil y casos asignados
│   └── /:advisorId/edit           # Editar perfil
│
├── /webinars                      # Gestión de webinars
│   ├── /                          # Lista de webinars
│   ├── /create                    # Crear webinar
│   ├── /:webinarId                # Ver detalles y registros
│   └── /:webinarId/edit           # Editar webinar
│
├── /legal-library                 # Biblioteca legal
│   ├── /                          # Lista de documentos
│   ├── /upload                    # Subir documento
│   ├── /categories                # Gestión de categorías
│   └── /:documentId/edit          # Editar documento
│
├── /comparator                    # Configuración del comparador
│   ├── /                          # Lista de casos
│   ├── /create                    # Crear caso
│   └── /:caseId/edit              # Editar caso
│
├── /timeline                      # Configuración de timeline
│   ├── /                          # Lista de templates
│   ├── /create                    # Crear template
│   └── /:templateId/edit          # Editar template
│
├── /welcome-video                 # Gestión de video de bienvenida
│   ├── /                          # Ver video actual
│   └── /upload                    # Subir nuevo video
│
├── /exports                       # Centro de exportación
│   ├── /                          # Historial de exportaciones
│   └── /new                       # Nueva exportación
│
└── /settings                      # Configuraciones generales
    ├── /profile                   # Perfil del admin
    ├── /security                  # Seguridad y contraseña
    └── /system                    # Configuraciones del sistema
```

---

## 4. ARQUITECTURA BACKEND - ENDPOINTS API

### Autenticación Admin
```
POST   /api/admin/auth/login             # Login con email/password
POST   /api/admin/auth/magic-link        # Enviar magic link
GET    /api/admin/auth/verify/:token     # Verificar magic link
POST   /api/admin/auth/logout            # Logout
GET    /api/admin/auth/me                # Info del admin actual
```

### Gestión de Staff
```
GET    /api/admin/staff                  # Lista de staff
POST   /api/admin/staff                  # Crear staff
GET    /api/admin/staff/:id              # Detalles de staff
PUT    /api/admin/staff/:id              # Actualizar staff
DELETE /api/admin/staff/:id              # Eliminar staff
GET    /api/admin/staff/roles            # Lista de roles disponibles
PUT    /api/admin/staff/:id/permissions  # Actualizar permisos
```

### Gestión de Usuarios (Clientes)
```
GET    /api/admin/users                  # Lista de usuarios
POST   /api/admin/users                  # Crear usuario
GET    /api/admin/users/:id              # Detalles de usuario
PUT    /api/admin/users/:id              # Actualizar usuario
DELETE /api/admin/users/:id              # Eliminar usuario
PUT    /api/admin/users/:id/status       # Cambiar estado
PUT    /api/admin/users/:id/assign-advisor   # Asignar asesor
POST   /api/admin/users/:id/notes        # Agregar nota
```

### Templates de Elegibilidad
```
GET    /api/admin/templates              # Lista de templates
POST   /api/admin/templates              # Crear template
GET    /api/admin/templates/:id          # Detalles de template
PUT    /api/admin/templates/:id          # Actualizar template
DELETE /api/admin/templates/:id          # Eliminar template
POST   /api/admin/templates/:id/assign   # Asignar a usuarios
```

### Asesoras
```
GET    /api/admin/advisors               # Lista de asesoras
POST   /api/admin/advisors               # Crear asesora
GET    /api/admin/advisors/:id           # Detalles de asesora
PUT    /api/admin/advisors/:id           # Actualizar asesora
DELETE /api/admin/advisors/:id           # Eliminar asesora
GET    /api/admin/advisors/:id/users     # Usuarios asignados
```

### Webinars
```
GET    /api/admin/webinars               # Lista de webinars
POST   /api/admin/webinars               # Crear webinar
GET    /api/admin/webinars/:id           # Detalles de webinar
PUT    /api/admin/webinars/:id           # Actualizar webinar
DELETE /api/admin/webinars/:id           # Eliminar webinar
GET    /api/admin/webinars/:id/registrations  # Registrados
```

### Biblioteca Legal
```
GET    /api/admin/legal-documents        # Lista de documentos
POST   /api/admin/legal-documents        # Subir documento
GET    /api/admin/legal-documents/:id    # Detalles
PUT    /api/admin/legal-documents/:id    # Actualizar
DELETE /api/admin/legal-documents/:id    # Eliminar
GET    /api/admin/legal-documents/categories  # Categorías
```

### Comparador
```
GET    /api/admin/comparator-cases       # Lista de casos
POST   /api/admin/comparator-cases       # Crear caso
GET    /api/admin/comparator-cases/:id   # Detalles
PUT    /api/admin/comparator-cases/:id   # Actualizar
DELETE /api/admin/comparator-cases/:id   # Eliminar
```

### Timeline
```
GET    /api/admin/timeline-templates     # Lista de templates
POST   /api/admin/timeline-templates     # Crear template
GET    /api/admin/timeline-templates/:id # Detalles
PUT    /api/admin/timeline-templates/:id # Actualizar
DELETE /api/admin/timeline-templates/:id # Eliminar
POST   /api/admin/timeline-templates/:id/set-default  # Marcar como default
```

### Video de Bienvenida
```
GET    /api/admin/welcome-videos         # Lista de videos
POST   /api/admin/welcome-videos         # Subir video
GET    /api/admin/welcome-videos/:id     # Detalles
PUT    /api/admin/welcome-videos/:id     # Actualizar
DELETE /api/admin/welcome-videos/:id     # Eliminar
POST   /api/admin/welcome-videos/:id/set-default  # Marcar como default
```

### Exportación
```
GET    /api/admin/exports                # Historial de exportaciones
POST   /api/admin/exports                # Crear nueva exportación
GET    /api/admin/exports/:id            # Estado de exportación
GET    /api/admin/exports/:id/download   # Descargar archivo
```

### Dashboard y Estadísticas
```
GET    /api/admin/dashboard/stats        # Estadísticas generales
GET    /api/admin/dashboard/recent-activity  # Actividad reciente
GET    /api/admin/dashboard/charts       # Datos para gráficos
```

---

## 5. FLUJO DE TRABAJO TÍPICO

### Crear Nuevo Usuario y Asignar Contenido
1. Admin crea usuario en `/admin/users/create`
2. Sistema genera credenciales y envía notificación
3. Admin asigna template de elegibilidad según profesión
4. Admin asigna asesora al usuario
5. Admin personaliza timeline si es necesario
6. Usuario recibe acceso a su dashboard con todo configurado

### Gestionar Webinar
1. Admin crea webinar en `/admin/webinars/create`
2. Webinar aparece automáticamente en dashboard de usuarios
3. Usuarios se registran desde su panel
4. Admin ve lista de registrados en tiempo real
5. Después del evento, admin sube grabación
6. Webinar pasa a "recorded" automáticamente

### Actualizar Biblioteca Legal
1. Admin sube documento en `/admin/legal-library/upload`
2. Selecciona categoría y agrega metadata
3. Documento aparece en biblioteca de usuarios según permisos
4. Sistema registra descargas y vistas
5. Admin puede ver estadísticas de uso

---

## 6. CONSIDERACIONES TÉCNICAS

### Seguridad
- Autenticación JWT para API
- Middleware de verificación de roles en cada endpoint
- Rate limiting en endpoints de autenticación
- Audit log de todas las acciones admin
- Encriptación de archivos sensibles

### Performance
- Paginación en todas las listas
- Cache de datos frecuentemente accedidos
- Lazy loading de imágenes y videos
- Índices de MongoDB en campos de búsqueda

### Almacenamiento
- Videos y documentos grandes: AWS S3 o similar
- Imágenes optimizadas con CDN
- Cleanup automático de archivos temporales

### Notificaciones
- Email notifications para magic link
- Notificaciones in-app para usuarios cuando se les asigna contenido
- Alertas para admins sobre actividad crítica

---

## 7. PLAN DE IMPLEMENTACIÓN

### Fase 1: Base (1-2 semanas)
- [ ] Autenticación admin (login, magic link)
- [ ] Dashboard principal con estadísticas básicas
- [ ] Gestión de staff (CRUD básico)
- [ ] Sistema de roles y permisos

### Fase 2: Contenido Core (2-3 semanas)
- [ ] Gestión de usuarios (clientes)
- [ ] Templates de elegibilidad
- [ ] Gestión de asesoras
- [ ] Asignación de asesoras a usuarios

### Fase 3: Contenido Dinámico (2-3 semanas)
- [ ] Webinars y eventos
- [ ] Biblioteca legal (con upload de archivos)
- [ ] Comparador
- [ ] Timeline templates

### Fase 4: Features Avanzadas (1-2 semanas)
- [ ] Video de bienvenida (upload y gestión)
- [ ] Sistema de exportación
- [ ] Activity log y auditoría
- [ ] Estadísticas avanzadas

### Fase 5: Optimización (1 semana)
- [ ] Performance optimization
- [ ] Testing completo
- [ ] Documentación
- [ ] Training materials

---

## 8. PRÓXIMOS PASOS

1. ✅ **Revisar y aprobar esta arquitectura**
2. Configurar estructura de carpetas y archivos
3. Crear modelos de MongoDB
4. Implementar autenticación admin
5. Desarrollar dashboard principal
6. Implementar módulos según fases

¿Apruebas esta arquitectura o necesitas ajustes?
