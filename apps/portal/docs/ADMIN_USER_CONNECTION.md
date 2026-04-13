# Conexión entre Panel Administrativo y Dashboard de Usuario

## 🔄 Arquitectura de Conexión

```
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                          │
│  (Única fuente de verdad - compartida por ambas interfaces) │
└─────────────────────────────────────────────────────────────┘
                    ▲                    ▲
                    │                    │
            ESCRIBE │                    │ LEE
                    │                    │
    ┌───────────────┴────────┐  ┌───────┴──────────────┐
    │   PANEL ADMIN          │  │   DASHBOARD USUARIO   │
    │   (/admin)             │  │   (/dashboard)        │
    │                        │  │                       │
    │  Admin CREA/EDITA:     │  │  Usuario VE:          │
    │  • Templates           │  │  • Su reporte         │
    │  • Asesoras            │  │  • Su asesora         │
    │  • Webinars            │  │  • Webinars           │
    │  • Documentos          │  │  • Biblioteca         │
    │  • Timeline            │  │  • Su timeline        │
    │  • Videos              │  │  • Videos             │
    └────────────────────────┘  └───────────────────────┘
```

## 📊 Ejemplos de Flujo de Datos

### 1️⃣ Asignación de Asesora
```
ADMIN PANEL                          DATABASE                    USER DASHBOARD
─────────────────────────────────────────────────────────────────────────────
Admin selecciona usuario      →     users.assignedAdvisor       →    Usuario ve perfil
"John Smith"                         {                                de su nueva asesora:
                                       id: "advisor-123",             • Gigliola Bocanegra
Admin selecciona asesora       →       assignedAt: Date,         →    • Foto
"Gigliola Bocanegra"                   assignedBy: "admin-001"        • Bio
                                     }                                • Especialidades
Click "Asignar" ───────────────────────────────────────────────→    • Estadísticas

                                                                     EFECTO INMEDIATO:
                                                                     • AdvisorProfile actualizado
                                                                     • Chat redirigido a ella
                                                                     • Notificación al usuario
```

### 2️⃣ Creación de Webinar
```
ADMIN PANEL                          DATABASE                    USER DASHBOARD
─────────────────────────────────────────────────────────────────────────────
Admin crea webinar          →        webinars collection         →   Webinar aparece en:
• Título: "EB-2 NIW Guide"           {                               • /dashboard/webinars
• Fecha: 15 Mayo 2025                  title: {...},                 • Dashboard home
• Capacidad: 50                        date: "2025-05-15",             (Featured section)
                                       capacity: 50,
Click "Publicar" ────────────────→     isActive: true           →   Usuario puede:
                                     }                               • Ver detalles
                                                                     • Registrarse
                                     webinars.registeredUsers    ←   • Ver contador
                                     ["user-001", ...]                 de disponibles
```

### 3️⃣ Template de Reporte de Elegibilidad
```
ADMIN PANEL                          DATABASE                    USER DASHBOARD
─────────────────────────────────────────────────────────────────────────────
Admin crea template         →        eligibility_templates       →   (Template guardado)
para Software Engineers              {
• Proyecto de IA                       name: "Software Engineer",
• Patente de ML                        profession: "Software...",
• Libro sobre IA                       content: {...}
                                     }

Admin asigna template       →        users.eligibilityReport     →   Usuario ve su reporte
al usuario "John Smith"              {                               personalizado:
                                       templateId: "template-123",   • Proyecto de IA
                                       customContent: {...}          • Patente sugerida
Click "Asignar" ────────────────→   }                          →    • Libro propuesto
                                                                     • Recomendaciones
                                                                     • Próximos pasos

                                                                     Todo traducido según
                                                                     idioma del usuario!
```

### 4️⃣ Subida de Documento Legal
```
ADMIN PANEL                          DATABASE                    USER DASHBOARD
─────────────────────────────────────────────────────────────────────────────
Admin sube PDF              →        legal_documents             →   Documento aparece
• "EB-2 NIW Guide 2025"              {                               en biblioteca:
• Categoría: Guides                    title: {...},                • /dashboard/legal-library
• Tags: eb2, niw                       category: "guides",          • Categoría "Guides"
                                       fileUrl: "s3://...",         • Descargable
Admin marca "Activo" ───────────→      isActive: true          →
                                     }                               Usuario puede:
                                                                     • Ver documento
                                                                     • Descargar PDF
                                                                     • Ver en ambos idiomas
```

### 5️⃣ Personalización de Timeline
```
ADMIN PANEL                          DATABASE                    USER DASHBOARD
─────────────────────────────────────────────────────────────────────────────
Admin edita timeline        →        users.customTimeline        →   Usuario ve timeline
para usuario específico              {                               actualizado:
• Reduce tiempo de RFE                 templateId: "...",           • Etapas modificadas
• Agrega nota especial                 customStages: [{...}],       • Tiempos ajustados
                                       lastUpdatedBy: "admin-001"   • Predicción nueva
Click "Guardar cambios" ────────→    }                          →
                                                                     Página se actualiza
                                                                     automáticamente al
                                                                     refrescar
```

### 6️⃣ Video de Bienvenida
```
ADMIN PANEL                          DATABASE                    USER DASHBOARD
─────────────────────────────────────────────────────────────────────────────
Admin sube video            →        welcome_videos              →   Modal de bienvenida
• Archivo: welcome.mp4               {                               se muestra:
• Duración: 2:30 min                   videoUrl: "s3://...",        • Video del CEO
• Marca como "Default"                 isDefault: true,             • Solo primera vez
                                       isActive: true               • One-time modal
Admin click "Activar" ──────────→    }                          →
                                                                     users.welcomeVideo
                                                                     {
                                                                       url: "...",
                                                                       viewed: false
                                                                     }

                                                                     Usuario ve video →
                                     users.welcomeVideo.viewed   ←   Sistema marca
                                     = true                          como visto
```

## 🔐 Separación de Interfaces

### Rutas Completamente Separadas

```javascript
// PANEL ADMIN - Solo accesible para staff
/admin/*
- Requiere: JWT de staff con rol válido
- Middleware: verifyStaffToken() + checkPermissions()
- UI: Dashboard administrativo completo

// DASHBOARD USUARIO - Solo accesible para clientes
/dashboard/*
- Requiere: Usuario autenticado (phone)
- Middleware: verifyUserAuth()
- UI: Dashboard de cliente
```

### Control de Acceso

```javascript
// Ejemplo de middleware
function verifyStaffToken(req, res, next) {
  const token = req.headers.authorization;
  const decoded = jwt.verify(token);
  
  // Verificar que es staff, no usuario
  if (decoded.type !== 'staff') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Verificar rol y permisos
  if (!hasPermission(decoded.role, req.path)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  next();
}

// Los usuarios NUNCA pueden acceder a /admin
// El staff PUEDE acceder a /dashboard (para preview/testing)
```

## 🔄 Sincronización en Tiempo Real

### Cambios Instantáneos
Cuando un admin hace cambios, el usuario los ve inmediatamente al:
1. **Refrescar la página**
2. **Navegar a otra sección y volver**
3. **WebSocket (opcional, para updates en tiempo real sin refresh)**

### Ejemplos de Sincronización:

```javascript
// Backend: Admin actualiza asesora
PUT /api/admin/users/:userId/assign-advisor
→ MongoDB actualiza users.assignedAdvisor

// Frontend Usuario: Siguiente carga
GET /api/user/profile
→ Recibe nueva información de asesora
→ UI se actualiza automáticamente
```

## 📱 Interfaces Visuales

### Panel Admin (para Staff)
```
┌─────────────────────────────────────────────────┐
│  URPE Admin Panel                    [Admin] ▼  │
├─────────────────────────────────────────────────┤
│ [Dashboard] [Users] [Templates] [Webinars]      │
│ [Advisors] [Library] [Timeline] [Exports]       │
├─────────────────────────────────────────────────┤
│                                                  │
│  👥 Users (523)          📊 Statistics          │
│                                                  │
│  📋 Recent Activity      ⚠️  Pending Tasks      │
│                                                  │
│  🎯 Quick Actions                                │
│  • Create new user                               │
│  • Upload document                               │
│  • Schedule webinar                              │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Dashboard Usuario (para Clientes)
```
┌─────────────────────────────────────────────────┐
│  URPE Integral Services          [John Smith] ▼ │
├─────────────────────────────────────────────────┤
│ [Home] [Elegibilidad] [Citas] [Mensajes]        │
│ [Webinars] [Biblioteca] [Calculadora]           │
├─────────────────────────────────────────────────┤
│                                                  │
│  👤 Your Advisor: Gigliola Bocanegra            │
│  📄 Eligibility Report: Software Engineer       │
│  📅 Next Webinar: EB-2 NIW Guide                │
│  📈 Timeline: 2.5 months to filing               │
│                                                  │
│  🎯 Quick Actions                                │
│  • View Report                                   │
│  • Schedule Appointment                          │
│  • Join Webinar                                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

## 🎯 Flujo Completo: Nuevo Cliente

```
1. ADMIN CREA USUARIO
   /admin/users/create
   → Ingresa: nombre, email, phone, profesión
   → MongoDB: users collection (nuevo documento)

2. ADMIN ASIGNA TEMPLATE
   /admin/users/:userId/report
   → Selecciona: "Software Engineer Template"
   → MongoDB: users.eligibilityReport.templateId

3. ADMIN ASIGNA ASESORA
   /admin/users/:userId/assign-advisor
   → Selecciona: "Gigliola Bocanegra"
   → MongoDB: users.assignedAdvisor.id

4. SISTEMA ENVÍA CREDENCIALES
   → Email/SMS con link de acceso
   → Usuario recibe: phone number como login

5. USUARIO INICIA SESIÓN
   /eligibility → ingresa phone
   → Sistema verifica en MongoDB
   → Redirecciona a /dashboard

6. USUARIO VE TODO CONFIGURADO
   /dashboard
   → Su reporte personalizado ✅
   → Su asesora asignada ✅
   → Webinars disponibles ✅
   → Biblioteca legal ✅
   → Timeline personalizado ✅
   → Video de bienvenida ✅

TODO ESTO SIN QUE EL USUARIO TENGA QUE CONFIGURAR NADA
```

## 💡 Ventajas de esta Arquitectura

✅ **Centralizado**: Una sola fuente de verdad (MongoDB)
✅ **Seguro**: Interfaces completamente separadas
✅ **Escalable**: Fácil agregar nuevos módulos
✅ **Flexible**: Admin controla todo el contenido
✅ **Inmediato**: Cambios se reflejan al instante
✅ **Auditable**: Todas las acciones registradas
✅ **Personalizable**: Cada usuario tiene su contenido
✅ **Multiidioma**: Todo traducido automáticamente

## 🚀 Próximos Pasos

1. ¿Apruebas esta arquitectura de conexión?
2. ¿Quieres agregar notificaciones push cuando admin hace cambios?
3. ¿Necesitas que el staff pueda "preview" el dashboard como si fuera el usuario?
4. ¿Implementamos WebSockets para updates en tiempo real?

**¿Procedemos con la implementación?**
