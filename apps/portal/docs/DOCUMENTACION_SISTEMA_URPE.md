# 📘 DOCUMENTACIÓN COMPLETA DEL SISTEMA URPE
## Sistema de Gestión para Casos EB-2 NIW

**Versión:** 1.0  
**Fecha:** Enero 2025  
**Autor:** Equipo de Desarrollo URPE

---

## 📋 ÍNDICE

1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Bases de Datos](#bases-de-datos)
4. [Flujo Completo del Usuario](#flujo-completo-del-usuario)
5. [Link Mágico: Cómo Funciona](#link-mágico-cómo-funciona)
6. [Sistema de Registro](#sistema-de-registro)
7. [Gestión de Etapas](#gestión-de-etapas)
8. [Sistema de Archivos](#sistema-de-archivos)
9. [Panel Administrativo](#panel-administrativo)
10. [Sistema de Revisiones](#sistema-de-revisiones)
11. [Pagos y Desbloqueo de Etapas](#pagos-y-desbloqueo-de-etapas)
12. [Notificaciones](#notificaciones)
13. [Errores Comunes y Soluciones](#errores-comunes-y-soluciones)
14. [Seguridad](#seguridad)
15. [Glosario de Términos](#glosario-de-términos)

---

## 📖 INTRODUCCIÓN

### ¿Qué es URPE?

URPE es una plataforma digital que gestiona el proceso completo de solicitud de visa EB-2 NIW (National Interest Waiver) para clientes que desean vivir y trabajar en Estados Unidos.

### Características Principales

- **Link Mágico:** Acceso personalizado sin necesidad de registro inicial
- **Dashboard Personalizado:** Vista única para cada cliente con su información
- **Gestión por Etapas:** Proceso dividido en 7 etapas claras
- **Colaboración Cliente-Asesor:** Subida y revisión de documentos
- **Sistema de Revisiones:** Hasta 2 modificaciones por documento
- **Panel Administrativo:** Gestión completa para asesores
- **Múltiples Opciones de Pago:** Flexibilidad para el cliente

### Tipos de Usuarios

1. **U1 (Usuario Invitado):** Persona que accede mediante link mágico pero aún no se ha registrado
2. **U3 (Usuario Registrado):** Persona con cuenta completa (email + contraseña)
3. **Asesor:** Miembro del equipo URPE asignado a casos específicos
4. **Administrador:** Acceso completo al sistema

---

## 🏗️ ARQUITECTURA GENERAL

### Componentes del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    ARQUITECTURA URPE                     │
└─────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   WhatsApp   │      │   Frontend   │      │   Backend    │
│   + Mónica   │─────▶│    React     │─────▶│   FastAPI    │
│   (IA Bot)   │      │              │      │   (Python)   │
└──────────────┘      └──────────────┘      └──────────────┘
       │                                             │
       │                                             │
       ▼                                             ▼
┌──────────────┐                            ┌──────────────┐
│   Supabase   │                            │   MongoDB    │
│  (Prospectos)│                            │ (Casos/Docs) │
└──────────────┘                            └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │   Storage    │
                                            │   (AWS S3)   │
                                            │  (Archivos)  │
                                            └──────────────┘
```

### Flujo de Información

1. **Mónica (WhatsApp)** → Recopila datos del prospecto → Guarda en **Supabase**
2. **Supabase** → Genera link mágico único
3. **Usuario** → Accede via link → **Frontend React**
4. **Frontend** → Valida token → **Backend FastAPI**
5. **Backend** → Consulta **Supabase** + **MongoDB**
6. **Usuario se registra** → Datos se guardan en **MongoDB**
7. **Archivos** → Se suben/descargan desde **AWS S3**

---

## 💾 BASES DE DATOS

### Supabase (PostgreSQL)

**Propósito:** Almacenar prospectos iniciales y gestionar links mágicos

#### Tabla: `prospects`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único |
| `phone` | VARCHAR | Teléfono del prospecto |
| `name` | VARCHAR | Nombre completo |
| `email` | VARCHAR | Email (inicialmente vacío) |
| `eligibility_score` | INTEGER | Puntaje de elegibilidad (0-100) |
| `visa_type` | VARCHAR | Tipo de visa (EB-2 NIW) |
| `country` | VARCHAR | País de origen |
| `profession` | VARCHAR | Profesión |
| `objective` | TEXT | Objetivo del prospecto |
| `timeline` | VARCHAR | Timeline esperado |
| `has_children` | BOOLEAN | ¿Tiene hijos menores de 21? |
| `has_spouse` | BOOLEAN | ¿Tiene cónyuge? |
| `language` | VARCHAR | Idioma preferido (es, en) |
| `magic_token` | VARCHAR | Token único para el link |
| `token_created_at` | TIMESTAMP | Fecha de creación del token |
| `token_expires_at` | TIMESTAMP | Fecha de expiración (30 días) |
| `is_converted` | BOOLEAN | ¿Ya se registró? |
| `mongodb_user_id` | VARCHAR | Referencia al ID en MongoDB |
| `assigned_advisor` | VARCHAR | Asesor asignado |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Última actualización |

**Ejemplo de datos:**
```
id: 123e4567-e89b-12d3-a456-426614174000
phone: +1234567890
name: Juan Pérez
email: null (al inicio)
eligibility_score: 87
visa_type: EB-2 NIW
country: Colombia
profession: Software Engineer
objective: Vivir en USA
timeline: 6-8 meses
has_children: false
has_spouse: true
language: es
magic_token: xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA
token_created_at: 2025-01-15 10:00:00
token_expires_at: 2025-02-14 10:00:00
is_converted: false
mongodb_user_id: null (se llena al registrarse)
assigned_advisor: Diego Urquijo
created_at: 2025-01-15 10:00:00
updated_at: 2025-01-15 10:00:00
```

---

### MongoDB

**Propósito:** Almacenar toda la información operativa del sistema

#### Colección: `users`

Usuarios registrados con cuenta completa.

```javascript
{
  "_id": ObjectId("..."),
  "user_id": "uuid-123",
  "name": "Juan Pérez",
  "email": "juan@email.com",
  "password": "hashed_password", // Encriptada
  "phone": "+1234567890",
  "user_type": "U3", // U1 (guest) o U3 (registrado)
  "country": "Colombia",
  "profession": "Software Engineer",
  "language": "es",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z",
  "supabase_prospect_id": "123e4567-..."
}
```

#### Colección: `visa_cases`

Casos de visa de cada usuario.

```javascript
{
  "_id": ObjectId("..."),
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "visa_type": "EB-2 NIW",
  "status": "active", // active, filed, approved
  "eligibility_score": 87,
  "objective": "Vivir en USA",
  "timeline": "6-8 meses",
  "has_children": false,
  "has_spouse": true,
  "current_stage": 1, // Etapa actual (1-6)
  "overall_progress": 14, // Porcentaje (0-100)
  "paid_amount": 0.0,
  "total_fee": 16997.0,
  "payment_plan": null, // "option_1", "option_1b", "option_2"
  "assigned_advisor": "Diego Urquijo",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

#### Colección: `stages`

Etapas del proceso de cada caso.

```javascript
{
  "_id": ObjectId("..."),
  "stage_id": "uuid-789",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "stage_number": 1, // 1-6
  "name": "Análisis y Formulario I-140",
  "status": "unlocked", // locked, unlocked, in_progress, completed
  "amount": 0.0, // Costo de esta etapa
  "is_paid": true,
  "percentage": 14, // Porcentaje del progreso total
  "total_deliverables": 4, // Cantidad de entregables
  "deliverables_completed": 1,
  "requires_user_input": true, // ¿Necesita que usuario suba algo?
  "user_input_completed": false,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

#### Colección: `deliverables`

Documentos que URPE entrega al cliente.

```javascript
{
  "_id": ObjectId("..."),
  "deliverable_id": "uuid-101",
  "stage_id": "uuid-789",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "stage_number": 1,
  "name": "Formulario I-140 Completado",
  "description": "Formulario I-140 llenado según requisitos USCIS",
  "status": "draft", // draft, unlocked, validated
  "file_url": "https://s3.../i140.pdf",
  "file_name": "I-140_Juan_Perez.pdf",
  "file_size": 2048000, // bytes
  "uploaded_at": "2025-01-20T14:30:00Z",
  "revision_count": 0, // Máximo 2
  "comments": [
    {
      "comment_id": "uuid-111",
      "text": "Por favor ajustar página 15...",
      "created_at": "2025-01-21T09:00:00Z"
    }
  ],
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-20T14:30:00Z"
}
```

#### Colección: `user_documents`

Documentos que el cliente sube al sistema.

```javascript
{
  "_id": ObjectId("..."),
  "document_id": "uuid-202",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "stage_number": 2,
  "document_type": "cv_with_support", // Tipo de documento
  "document_name": "Hoja de vida con soportes",
  "file_url": "https://s3.../cv.pdf",
  "file_name": "CV_Juan_Perez.pdf",
  "file_size": 5120000, // bytes
  "status": "uploaded", // pending, uploaded, validated
  "uploaded_at": "2025-01-18T09:00:00Z",
  "created_at": "2025-01-18T09:00:00Z"
}
```

#### Colección: `payments`

Registro de pagos realizados.

```javascript
{
  "_id": ObjectId("..."),
  "payment_id": "uuid-303",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "amount": 1500.0,
  "payment_method": "stripe",
  "stripe_payment_id": "pi_xxxxx",
  "status": "completed", // pending, completed, failed
  "description": "Pago Etapa 2 - Creación de Empresa",
  "stage_number": 2,
  "created_at": "2025-01-20T10:00:00Z",
  "completed_at": "2025-01-20T10:05:00Z"
}
```

#### Colección: `recommendation_letters`

Cartas de recomendación (Etapa 5).

```javascript
{
  "_id": ObjectId("..."),
  "letter_id": "uuid-404",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "stage_number": 5,
  "recommender_name": "Dr. Juan Pérez",
  "recommender_email": "juan.perez@universidad.edu",
  "recommender_title": "Profesor de Ingeniería",
  "form_sent_at": "2025-02-01T10:00:00Z",
  "form_completed_at": "2025-02-03T14:00:00Z",
  "form_data": {}, // Respuestas del formulario
  "letter_status": "draft", // pending, draft, approved, final
  "letter_url": "https://s3.../carta_juan_perez.pdf",
  "revision_count": 0,
  "comments": [],
  "created_at": "2025-02-01T10:00:00Z",
  "updated_at": "2025-02-05T16:00:00Z"
}
```

#### Colección: `intake_forms`

Formulario de intake (Etapa 1).

```javascript
{
  "_id": ObjectId("..."),
  "form_id": "uuid-505",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "stage_number": 1,
  "status": "completed", // in_progress, completed
  "language": "es", // Idioma en que lo llenó
  "sections": {
    "personal_info": {
      "full_name": "Juan Pérez",
      "date_of_birth": "1990-05-15",
      "country_of_birth": "Colombia",
      // ... más campos
    },
    "family": {
      "has_spouse": true,
      "spouse_name": "María García",
      "has_children": false,
      // ... más campos
    },
    "education": [...],
    "experience": [...],
    "achievements": [...],
    "languages": [...],
    "travel_history": [...],
    "legal_info": [...]
  },
  "started_at": "2025-01-16T10:00:00Z",
  "completed_at": "2025-01-16T10:45:00Z",
  "created_at": "2025-01-16T10:00:00Z",
  "updated_at": "2025-01-16T10:45:00Z"
}
```

#### Colección: `final_petition`

Expediente final compilado (Etapa 6).

```javascript
{
  "_id": ObjectId("..."),
  "petition_id": "uuid-606",
  "case_id": "uuid-456",
  "user_id": "uuid-123",
  "stage_number": 6,
  "status": "pending_approval", // compiled, pending_approval, approved, filed
  "pdf_url": "https://s3.../expediente_completo.pdf",
  "pdf_pages": 542,
  "approved_by_user": false,
  "approved_at": null,
  "tracking_number": null,
  "tracking_url": null,
  "shipped_at": null,
  "receipt_notice_number": null,
  "receipt_notice_url": null,
  "receipt_notice_received_at": null,
  "created_at": "2025-03-01T10:00:00Z",
  "updated_at": "2025-03-01T10:00:00Z"
}
```

#### Colección: `notifications`

Notificaciones enviadas a usuarios.

```javascript
{
  "_id": ObjectId("..."),
  "notification_id": "uuid-707",
  "user_id": "uuid-123",
  "case_id": "uuid-456",
  "type": "stage_completed", // Tipo de notificación
  "title": "¡Etapa 2 Completada!",
  "message": "Tu Etapa 2 está lista para revisión",
  "read": false,
  "action_url": "/dashboard/stages/2",
  "created_at": "2025-01-25T16:00:00Z"
}
```

#### Colección: `meetings`

Citas agendadas entre cliente y asesor.

```javascript
{
  "_id": ObjectId("..."),
  "meeting_id": "uuid-808",
  "user_id": "uuid-123",
  "case_id": "uuid-456",
  "stage_number": 2,
  "type": "review_session", // review_session, consultation
  "scheduled_at": "2025-01-26T10:00:00Z",
  "duration_minutes": 30,
  "zoom_link": "https://zoom.us/j/xxxxx",
  "coordinator_name": "Diego Urquijo",
  "status": "scheduled", // scheduled, completed, cancelled
  "notes": "",
  "created_at": "2025-01-25T16:30:00Z"
}
```

---

## 🔄 FLUJO COMPLETO DEL USUARIO

### Paso 1: Mónica Califica al Prospecto (WhatsApp)

**Actor:** Mónica (IA Bot) + Prospecto

**Acciones:**
1. Prospecto ve anuncio en Meta y hace clic
2. Es redirigido a WhatsApp
3. Mónica lo saluda y comienza a hacer preguntas:
   - ¿Cuál es tu nombre completo?
   - ¿Cuál es tu profesión?
   - ¿En qué país vives actualmente?
   - ¿Tienes hijos menores de 21 años?
   - ¿Tienes cónyuge?
   - ¿Cuál es tu objetivo principal?
   - ¿Cuándo necesitas tu visa?

4. Mónica analiza las respuestas y determina elegibilidad
5. Si es elegible, guarda todos los datos en Supabase
6. Genera un token mágico único (ej: `xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA`)
7. Crea el link: `https://urpe.com/welcome/xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA`
8. Envía mensaje a prospecto:

```
¡Excelente, Juan! 🎉

Eres elegible para EB-2 NIW con un 87% de probabilidad de aprobación.

En este link puedes ver tu reporte completo:
https://urpe.com/welcome/xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA

¡Te esperamos! 🚀
```

**Datos guardados en Supabase:**
- Todos los datos recopilados
- Token mágico generado
- Fecha de creación y expiración (30 días)
- Asesor asignado (automático según disponibilidad)
- Estado: `is_converted = false`

---

### Paso 2: Usuario Accede al Link Mágico

**Actor:** Prospecto (Juan)

**Acciones:**
1. Juan hace clic en el link desde WhatsApp
2. El navegador abre: `https://urpe.com/welcome/xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA`

**¿Qué pasa en el sistema?**

**Frontend:**
1. Lee el token de la URL: `xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA`
2. Envía el token al backend para validación

**Backend:**
1. Recibe el token
2. Busca en Supabase: `SELECT * FROM prospects WHERE magic_token = 'xK9mP2...'`
3. Encuentra el registro de Juan
4. Verifica que:
   - El token existe
   - No ha expirado (fecha actual < `token_expires_at`)
   - No fue usado antes (`is_converted = false`)
5. Si todo está bien, retorna los datos de Juan al frontend

**Frontend:**
1. Recibe los datos de Juan
2. Guarda temporalmente en localStorage
3. Muestra modal de video de bienvenida
4. Después del video, muestra Dashboard U1 personalizado

---

### Paso 3: Dashboard U1 (Sin Registro)

**Actor:** Prospecto (Juan) - Usuario Invitado

**¿Qué ve Juan?**

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  👋 ¡Hola Juan Pérez!                       ┃
┃                                             ┃
┃  📊 TU REPORTE DE ELEGIBILIDAD              ┃
┃  ✅ Eres elegible para EB-2 NIW             ┃
┃  📈 Probabilidad de aprobación: 87% (Alta)  ┃
┃  [📥 Descargar reporte PDF]                 ┃
┃                                             ┃
┃  🗺️ TU RUTA PERSONALIZADA                  ┃
┃  Timeline interactivo visual                ┃
┃  ⏱️ Tiempo estimado: 6-8 meses              ┃
┃  [📥 Descargar ruta PDF]                    ┃
┃                                             ┃
┃  🎁 TU PAQUETE BLACK FRIDAY                 ┃
┃  📄 Formulario I-140 Completado             ┃
┃  📚 Manual DIY Completo                     ┃
┃  🔒 Regístrate gratis para descargar        ┃
┃  [📝 Crear cuenta gratis]                   ┃
┃                                             ┃
┃  🚀 ¿LISTO PARA COMENZAR CON URPE?          ┃
┃  [Comenzar con URPE]                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**Funcionalidad:**
- Puede ver su reporte de elegibilidad
- Puede ver su ruta personalizada
- NO puede descargar I-140 ni Manual (debe registrarse)
- NO puede avanzar a etapas (debe registrarse)

**Objetivo:** Convencer a Juan de registrarse mostrándole el valor.

---

### Paso 4: Registro (U1 → U3)

**Actor:** Prospecto (Juan)

**Acciones:**
1. Juan hace clic en "Crear cuenta gratis"
2. Ve formulario de registro:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📝 Crea tu cuenta                          ┃
┃                                             ┃
┃  Email: [juan@email.com]                    ┃
┃  Contraseña: [••••••••]                     ┃
┃                                             ┃
┃  ☑️ Acepto los [Términos y Condiciones]     ┃
┃                                             ┃
┃  [Crear cuenta gratis]                      ┃
┃                                             ┃
┃  ¿Ya tienes cuenta? [Iniciar sesión]        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

3. Juan llena email y contraseña
4. Hace clic en checkbox de términos
5. Hace clic en "Crear cuenta gratis"

**¿Qué pasa en el sistema?**

**Frontend:**
1. Valida que email sea válido
2. Valida que contraseña sea fuerte (mín 8 caracteres)
3. Valida que checkbox esté marcado
4. Obtiene el token mágico guardado en localStorage
5. Envía al backend:
   ```json
   {
     "prospect_token": "xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA",
     "email": "juan@email.com",
     "password": "contraseña_segura"
   }
   ```

**Backend:**

1. **Valida el token** en Supabase
   - Busca el prospecto
   - Verifica que no esté convertido

2. **Verifica email** en MongoDB
   - Busca si ya existe: `db.users.findOne({email: "juan@email.com"})`
   - Si existe → ERROR: "Email ya registrado"
   - Si no existe → Continúa

3. **Crea usuario en MongoDB:**
   ```javascript
   {
     "user_id": "uuid-123",
     "name": "Juan Pérez", // De Supabase
     "email": "juan@email.com",
     "password": "hashed_password", // Encriptada
     "phone": "+1234567890", // De Supabase
     "user_type": "U3",
     "country": "Colombia",
     "profession": "Software Engineer",
     "language": "es",
     "created_at": "2025-01-15T10:00:00Z",
     "supabase_prospect_id": "123e4567-..."
   }
   ```

4. **Crea caso de visa en MongoDB:**
   ```javascript
   {
     "case_id": "uuid-456",
     "user_id": "uuid-123",
     "visa_type": "EB-2 NIW",
     "status": "active",
     "eligibility_score": 87,
     "current_stage": 1,
     "overall_progress": 0,
     "paid_amount": 0.0,
     "total_fee": 16997.0,
     "assigned_advisor": "Diego Urquijo"
   }
   ```

5. **Crea las 7 etapas:**
   - Etapa 1: `status: "unlocked"` (desbloqueada desde el inicio)
   - Etapas 2-6: `status: "locked"` (bloqueadas)

6. **Crea entregables de Etapa 1:**
   - Reporte de elegibilidad (ya listo)
   - Ruta personalizada (ya lista)
   - I-140 completado (pendiente de formulario intake)
   - Manual DIY (pendiente)

7. **Actualiza Supabase:**
   ```javascript
   {
     "is_converted": true,
     "mongodb_user_id": "uuid-123",
     "email": "juan@email.com",
     "updated_at": "2025-01-15T10:05:00Z"
   }
   ```

8. **Genera JWT token:**
   ```javascript
   {
     "user_id": "uuid-123",
     "email": "juan@email.com",
     "user_type": "U3",
     "exp": "2025-02-14T10:05:00Z" // Expira en 30 días
   }
   ```

9. **Retorna al frontend:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "user_id": "uuid-123",
       "name": "Juan Pérez",
       "email": "juan@email.com",
       "user_type": "U3",
       "case_id": "uuid-456"
     }
   }
   ```

**Frontend:**
1. Recibe el token y datos del usuario
2. Guarda en localStorage:
   - `token`: "eyJhbGciOiJIUzI1NiIs..."
   - `user`: datos del usuario
3. Limpia datos temporales del prospecto
4. Redirige a Dashboard U3

---

### Paso 5: Dashboard U3 (Usuario Registrado)

**Actor:** Usuario Registrado (Juan)

**¿Qué ve Juan?**

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🎯 Tu Caso EB-2 NIW - Juan Pérez          ┃
┃                                             ┃
┃  Progreso General: ▓▓░░░░░░ 14% (1/7)      ┃
┃  Tiempo estimado restante: 6-8 meses        ┃
┃  Asesor asignado: Diego Urquijo             ┃
┃                                             ┃
┃  ⚡ ACCIÓN REQUERIDA:                       ┃
┃  Completa tu formulario de intake           ┃
┃  [Completar ahora] ⏱️ 45 min aprox          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📦 ETAPA 1: ANÁLISIS Y FORMULARIO I-140   ┃
┃  [ACTIVA - En progreso]                     ┃
┃                                             ┃
┃  💰 Costo: $0 (GRATIS Black Friday)         ┃
┃                                             ┃
┃  📝 LO QUE NECESITAMOS DE TI:               ┃
┃  ⏳ Completar formulario de intake          ┃
┃     [▶️ Comenzar formulario]                ┃
┃                                             ┃
┃  📄 LO QUE ENTREGAREMOS:                    ┃
┃  ✅ Reporte de elegibilidad                 ┃
┃  ✅ Ruta personalizada                      ┃
┃  🔒 I-140 completado (espera tu formulario) ┃
┃  🔒 Manual DIY                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

🔒 ETAPA 2: CREACIÓN DE EMPRESA [Bloqueada]
💰 Inversión: Parte de $6,790 inicial
[Ver qué incluye]

🔒 ETAPA 3: CONTENIDO ACADÉMICO [Bloqueada]
[Ver qué incluye]

🔒 ETAPA 4: PRESENCIA DIGITAL [Bloqueada]
[Ver qué incluye]

⭐ ETAPA 4.1: PUBLICACIONES (Opcional) [Bloqueada]
💰 +$1,395
[Ver opciones]

🔒 ETAPA 5: CARTAS DE RECOMENDACIÓN [Bloqueada]
[Ver qué incluye]

🔒 ETAPA 6: RADICACIÓN [Bloqueada]
[Ver qué incluye]
```

**Funcionalidad:**
- Ve todas las etapas del proceso
- Etapa 1 está desbloqueada y activa
- Puede completar formulario de intake
- Las demás etapas están bloqueadas (aparecen difuminadas)
- Puede ver qué incluye cada etapa

---

## 🔐 LINK MÁGICO: CÓMO FUNCIONA

### ¿Qué es un Link Mágico?

Un link mágico es una URL única y personalizada que permite a un usuario acceder a su información sin necesidad de iniciar sesión. Es como una "llave digital" que abre una puerta específica.

### Componentes del Link Mágico

```
https://urpe.com/welcome/xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA
│                       │                                  │
│                       │                                  └─ Token Mágico (único)
│                       └─────────────────────────────────── Ruta de bienvenida
└─────────────────────────────────────────────────────────── Dominio
```

### Generación del Token

**Características:**
- **Único:** Cada prospecto tiene su propio token
- **Aleatorio:** Imposible de adivinar
- **Seguro:** 32 bytes de entropía (muy difícil de hackear)
- **Temporal:** Expira en 30 días
- **De un solo uso:** Una vez registrado, no se puede usar de nuevo

**Proceso de generación (técnico):**
```python
import secrets

# Genera token aleatorio de 32 bytes
token = secrets.token_urlsafe(32)
# Resultado: "xK9mP2nQ7vR4sL8wB3jF5tY1cH6dN0zA"
```

### Validación del Token

Cuando un usuario accede al link, el sistema valida:

1. **¿Existe el token?**
   - Busca en Supabase: `SELECT * FROM prospects WHERE magic_token = 'xxx'`
   - Si no existe → ERROR: "Link inválido"

2. **¿Está expirado?**
   - Compara fecha actual vs `token_expires_at`
   - Si expiró → ERROR: "Link expirado"

3. **¿Ya fue usado?**
   - Revisa campo `is_converted`
   - Si es `true` → REDIRIGE: "Ya tienes cuenta, inicia sesión"

4. **¿Todo OK?**
   - Retorna datos del prospecto
   - Frontend muestra dashboard personalizado

### Seguridad del Link Mágico

**Protecciones implementadas:**

1. **Expiración automática:** Después de 30 días, el link deja de funcionar
2. **Un solo uso:** Una vez registrado, el link no sirve más
3. **HTTPS obligatorio:** Toda comunicación es encriptada
4. **No reutilizable:** Cada prospecto nuevo recibe un token diferente
5. **Imposible de adivinar:** 32 bytes aleatorios = 2^256 combinaciones posibles

**Ataques prevenidos:**
- ❌ Fuerza bruta (imposible adivinar)
- ❌ Reutilización (bloqueado después de registro)
- ❌ Expiración (30 días máximo)
- ❌ Man-in-the-middle (HTTPS)

---

## 🎓 SISTEMA DE REGISTRO

### Flujo de Registro

```
Usuario invitado (U1)
    ↓
Hace clic en "Crear cuenta"
    ↓
Llena formulario:
  - Email
  - Contraseña
  - Acepta términos
    ↓
Frontend valida:
  ✓ Email válido
  ✓ Contraseña fuerte
  ✓ Términos aceptados
    ↓
Envía al backend con token mágico
    ↓
Backend valida:
  ✓ Token mágico válido
  ✓ Email no existe en MongoDB
  ✓ Prospecto no convertido
    ↓
Backend crea:
  1. Usuario en MongoDB
  2. Caso de visa en MongoDB
  3. 7 Etapas en MongoDB
  4. Entregables de Etapa 1
    ↓
Backend actualiza Supabase:
  - is_converted = true
  - mongodb_user_id = "uuid-123"
  - email = "juan@email.com"
    ↓
Backend genera JWT token
    ↓
Frontend recibe token
    ↓
Frontend guarda en localStorage
    ↓
Redirige a Dashboard U3
    ↓
Usuario registrado (U3) ✅
```

### Validaciones

**Frontend:**
- Email debe tener formato válido (contiene @ y dominio)
- Contraseña mínimo 8 caracteres
- Contraseña debe contener al menos:
  - Una letra mayúscula
  - Una letra minúscula
  - Un número
- Checkbox de términos debe estar marcado

**Backend:**
- Token mágico existe en Supabase
- Token no expirado
- Prospecto no convertido previamente
- Email no existe en MongoDB
- Contraseña cumple requisitos de seguridad

### Errores Comunes

**Error: Email ya registrado**
```
Causa: Otro usuario ya usó ese email
Solución: Usar otro email o iniciar sesión
```

**Error: Token inválido**
```
Causa: Link manipulado o incorrecto
Solución: Solicitar nuevo link a soporte
```

**Error: Token expirado**
```
Causa: Pasaron más de 30 días desde que se generó
Solución: Contactar a soporte para nuevo link
```

**Error: Ya tienes cuenta**
```
Causa: Ya te registraste previamente con este link
Solución: Ir a iniciar sesión
```

---

## 📦 GESTIÓN DE ETAPAS

### Estructura de Etapas

El proceso EB-2 NIW se divide en 7 etapas:

```
┌─────────────────────────────────────────────────────────┐
│  ETAPA 1: Análisis y Formulario I-140                   │
│  Costo: $0 (GRATIS Black Friday)                        │
│  Estado inicial: DESBLOQUEADA                           │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 2: Creación de Empresa                           │
│  Costo: Parte de $6,790 inicial                         │
│  Estado inicial: BLOQUEADA                              │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 2.1: Incorporación Legal (OPCIONAL)              │
│  Costo: +$500 adicional                                 │
│  Requiere: Social Security Number                       │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 3: Contenido Académico                           │
│  Costo: Parte de $6,790 inicial                         │
│  Estado inicial: BLOQUEADA                              │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 4: Presencia Digital                             │
│  Costo: Parte de $6,790 inicial                         │
│  Estado inicial: BLOQUEADA                              │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 4.1: Publicaciones (OPCIONAL)                    │
│  Costo: +$1,395 adicional                               │
│  Agrega: 30-45 días hábiles al proceso                  │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 5: Cartas de Recomendación                       │
│  Costo: Parte de $6,790 inicial                         │
│  Estado inicial: BLOQUEADA                              │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  ETAPA 6: Radicación                                    │
│  Costo: Parte de $6,790 inicial                         │
│  Estado inicial: BLOQUEADA                              │
└─────────────────────────────────────────────────────────┘
```

### Estados de una Etapa

Una etapa puede estar en los siguientes estados:

| Estado | Descripción | Cliente puede |
|--------|-------------|---------------|
| `locked` | Bloqueada, no accesible | Ver qué incluye, pero no acceder |
| `unlocked` | Desbloqueada pero no iniciada | Pagar (si requiere pago) o subir documentos |
| `in_progress` | En progreso, cliente o asesor trabajando | Ver progreso, subir/descargar archivos |
| `completed` | Completada, esperando revisión del cliente | Revisar documentos, hacer comentarios |
| `validated` | Cliente aprobó todos los entregables | Ver documentos finales |

### Progreso General

El progreso se calcula según las etapas completadas:

```
Etapa 1: 14% (1/7)
Etapa 2: 28% (2/7)
Etapa 3: 42% (3/7)
Etapa 4: 56% (4/7)
Etapa 5: 78% (5/7)
Etapa 6: 100% (6/7) + Etapa final
```

**Nota:** Las etapas opcionales (2.1 y 4.1) no afectan el porcentaje base.

### Desbloqueo de Etapas

**Reglas:**
1. Etapa 1 se desbloquea automáticamente al registrarse
2. Etapas 2-6 requieren:
   - Pago de la etapa (si aplica)
   - Completar etapa anterior

**Flujo de desbloqueo:**
```
Cliente paga Etapa 2
    ↓
Backend actualiza:
  - stage.status = "unlocked"
  - stage.is_paid = true
    ↓
Cliente ve: Etapa 2 desbloqueada
    ↓
Cliente sube documentos requeridos
    ↓
Backend actualiza:
  - stage.status = "in_progress"
  - stage.user_input_completed = true
    ↓
Asesor trabaja en entregables
    ↓
Asesor sube entregables terminados
    ↓
Backend actualiza:
  - stage.status = "completed"
  - deliverables.status = "unlocked"
    ↓
Cliente recibe notificación
    ↓
Cliente revisa y aprueba documentos
    ↓
Backend actualiza:
  - deliverables.status = "validated"
  - stage.status = "validated"
    ↓
Backend desbloquea Etapa 3:
  - stage_3.status = "unlocked"
    ↓
Cliente ve: Etapa 3 desbloqueada ✅
```

---

## 📁 SISTEMA DE ARCHIVOS

### Tipos de Archivos

**1. Archivos que sube el CLIENTE:**
- CV con soportes
- Documentos de identificación (pasaporte, cédula)
- Fotos profesionales (para Etapa 4.1)
- Respuestas de formularios

**2. Archivos que sube el ASESOR:**
- Registro de patente
- Logos profesionales
- Business Plan
- Estudio econométrico
- White Paper técnico
- Policy Paper
- Caso de estudio
- MVP de web app (link + screenshots)
- Cartas de recomendación
- Expediente final compilado
- Receipt Notice de USCIS

### Flujo de Subida de Archivos (Cliente)

```
┌─────────────────────────────────────────────────────────┐
│  Cliente en Dashboard → Etapa 2                         │
└─────────────────────────────────────────────────────────┘
    ↓
Cliente hace clic en "Subir archivo"
    ↓
┌─────────────────────────────────────────────────────────┐
│  📤 Sube tus documentos:                                │
│                                                          │
│  📄 Hoja de vida con soportes                           │
│  [Seleccionar archivo]                                  │
│  Formatos: PDF (máx 10MB)                               │
└─────────────────────────────────────────────────────────┘
    ↓
Cliente selecciona archivo: CV_Juan.pdf (5MB)
    ↓
Frontend valida:
  ✓ Tamaño < 10MB
  ✓ Formato PDF
    ↓
Cliente hace clic en "Subir"
    ↓
Frontend muestra progreso:
  Subiendo: ▓▓▓▓▓░░░░░ 50%
    ↓
Backend recibe archivo
    ↓
Backend valida:
  ✓ Archivo no corrupto
  ✓ Es realmente un PDF
    ↓
Backend sube a AWS S3:
  URL: https://s3.../cases/uuid-456/stage-2/CV_Juan.pdf
    ↓
Backend guarda en MongoDB:
  Colección: user_documents
  {
    "document_id": "uuid-202",
    "case_id": "uuid-456",
    "user_id": "uuid-123",
    "stage_number": 2,
    "document_type": "cv_with_support",
    "file_url": "https://s3.../CV_Juan.pdf",
    "file_name": "CV_Juan.pdf",
    "file_size": 5242880,
    "status": "uploaded",
    "uploaded_at": "2025-01-20T10:30:00Z"
  }
    ↓
Backend retorna al frontend:
  {
    "success": true,
    "document_id": "uuid-202",
    "message": "Documento subido exitosamente"
  }
    ↓
Frontend actualiza UI:
  ✅ CV_Juan.pdf subido correctamente
    ↓
Backend envía notificación al asesor:
  📧 Email a Diego: "Juan subió CV"
  🔔 Notificación en panel admin
    ↓
Asesor ve en su panel:
  📥 Nuevo documento de Juan Pérez
  [Descargar CV_Juan.pdf]
```

### Flujo de Subida de Archivos (Asesor)

```
┌─────────────────────────────────────────────────────────┐
│  Asesor en Panel Admin → Caso Juan Pérez               │
└─────────────────────────────────────────────────────────┘
    ↓
Asesor trabaja en Business Plan
    ↓
Asesor termina documento: BusinessPlan_Juan.pdf (50 páginas)
    ↓
Asesor va a panel admin
    ↓
┌─────────────────────────────────────────────────────────┐
│  📤 SUBIR ENTREGABLES - Etapa 2                         │
│     Caso: Juan Pérez                                    │
│                                                          │
│  📄 Business Plan                                       │
│  [Seleccionar archivo]                                  │
│  [Subir archivo]                                        │
└─────────────────────────────────────────────────────────┘
    ↓
Asesor selecciona: BusinessPlan_Juan.pdf
    ↓
Asesor hace clic en "Subir archivo"
    ↓
Backend sube a AWS S3:
  URL: https://s3.../cases/uuid-456/stage-2/BusinessPlan_Juan.pdf
    ↓
Backend guarda en MongoDB:
  Colección: deliverables
  {
    "deliverable_id": "uuid-301",
    "case_id": "uuid-456",
    "stage_number": 2,
    "name": "Business Plan",
    "status": "unlocked", // Listo para revisión del cliente
    "file_url": "https://s3.../BusinessPlan_Juan.pdf",
    "file_name": "BusinessPlan_Juan.pdf",
    "file_size": 10485760,
    "uploaded_at": "2025-01-25T16:30:00Z",
    "revision_count": 0
  }
    ↓
Asesor hace lo mismo con los demás entregables:
  ✅ Registro de patente
  ✅ Logos profesionales
  ✅ Estudio econométrico
    ↓
Asesor hace clic en "Marcar Etapa 2 como Completada"
    ↓
Backend actualiza:
  - stage.status = "completed"
  - stage.deliverables_completed = 4
    ↓
Backend envía notificaciones:
  📧 Email a Juan: "¡Etapa 2 completada!"
  📱 WhatsApp a Juan
  🔔 Notificación en dashboard
    ↓
Juan recibe notificación y entra al dashboard
    ↓
Juan ve:
  ✅ Etapa 2 Completada
  📄 4 documentos listos para revisión
  [Ver documentos]
```

### Descargar Archivos

**Cliente descarga entregables:**
```
Cliente hace clic en "Ver" o "Descargar"
    ↓
Frontend solicita al backend el archivo
    ↓
Backend genera URL firmada temporal (válida 1 hora):
  https://s3.../BusinessPlan_Juan.pdf?signature=xxx&expires=...
    ↓
Frontend redirige al usuario a esa URL
    ↓
Navegador descarga el archivo
```

**Asesor descarga documentos del cliente:**
```
Asesor hace clic en "Descargar"
    ↓
Backend verifica que el asesor tenga permiso:
  - Asesor está asignado a ese caso
    ↓
Backend genera URL firmada temporal
    ↓
Asesor descarga el archivo
```

### Límites y Validaciones

**Archivos del cliente:**
- Tamaño máximo: 10 MB por archivo
- Formatos permitidos: PDF, JPG, PNG
- Validación de virus/malware
- Validación de integridad (archivo no corrupto)

**Archivos del asesor:**
- Tamaño máximo: 50 MB por archivo
- Formatos permitidos: PDF, ZIP, JPG, PNG
- Validación de integridad

**Almacenamiento:**
- Servidor: AWS S3
- Región: us-east-1
- Backup: Automático diario
- Retención: Permanente (mientras el caso esté activo)

---

## 👨‍💼 PANEL ADMINISTRATIVO

### Funcionalidades del Panel Admin

El panel administrativo es utilizado por los asesores de URPE para gestionar sus casos asignados.

### Dashboard del Asesor

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🏢 PANEL ADMINISTRATIVO                    ┃
┃     Asesor: Diego Urquijo                   ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  📊 RESUMEN                                 ┃
┃  • Casos activos: 12                        ┃
┃  • Casos pendientes de acción: 3            ┃
┃  • Etapas completadas esta semana: 8        ┃
┃                                             ┃
┃  📋 MIS CASOS ASIGNADOS:                    ┃
┃                                             ┃
┃  ┌──────────────────────────────────────┐  ┃
┃  │ 👤 Juan Pérez                        │  ┃
┃  │ ✉️ juan@email.com                    │  ┃
┃  │ 📞 +1234567890                       │  ┃
┃  │ 🎯 Caso: CASE-789                    │  ┃
┃  │ 📊 Etapa actual: 2 (En progreso)     │  ┃
┃  │ ⚡ Acción: Cliente subió documentos   │  ┃
┃  │                                       │  ┃
┃  │ [Ver caso completo]                  │  ┃
┃  └──────────────────────────────────────┘  ┃
┃                                             ┃
┃  ┌──────────────────────────────────────┐  ┃
┃  │ 👤 María García                      │  ┃
┃  │ 📊 Etapa actual: 4 (Completada)      │  ┃
┃  │ ⚡ Acción: Cliente debe revisar docs │  ┃
┃  │ [Ver caso completo]                  │  ┃
┃  └──────────────────────────────────────┘  ┃
┃                                             ┃
┃  [Ver todos mis casos]                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Vista Detallada de un Caso

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📋 Caso: Juan Pérez (CASE-789)            ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  👤 INFORMACIÓN DEL CLIENTE                 ┃
┃  Nombre: Juan Pérez                         ┃
┃  Email: juan@email.com                      ┃
┃  Teléfono: +1234567890                      ┃
┃  País: Colombia                             ┃
┃  Profesión: Software Engineer               ┃
┃                                             ┃
┃  📊 ESTADO DEL CASO                         ┃
┃  Progreso: 28% (2/7 etapas)                 ┃
┃  Etapa actual: 2 - En progreso              ┃
┃  Pagado: $1,500 de $6,790 inicial           ┃
┃  Plan de pago: Opción 1 (por etapas)        ┃
┃                                             ┃
┃  [Tabs: Etapas | Documentos | Pagos | Chat] ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Tab: Etapas

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📦 ETAPA 2: CREACIÓN DE EMPRESA           ┃
┃  Estado: En progreso                        ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  📥 DOCUMENTOS DEL CLIENTE:                 ┃
┃                                             ┃
┃  📄 CV_Juan.pdf                             ┃
┃     Subido: 20 ene 2025, 10:30am            ┃
┃     Tamaño: 5 MB                            ┃
┃     [📥 Descargar] [👁️ Ver]                 ┃
┃                                             ┃
┃  📄 Pasaporte_Juan.pdf                      ┃
┃     Subido: 20 ene 2025, 10:35am            ┃
┃     Tamaño: 2 MB                            ┃
┃     [📥 Descargar] [👁️ Ver]                 ┃
┃                                             ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  📤 SUBIR ENTREGABLES:                      ┃
┃                                             ┃
┃  📄 Registro de Patente                     ┃
┃     Estado: Pendiente                       ┃
┃     [Seleccionar archivo] [Subir]           ┃
┃                                             ┃
┃  📄 Logos Profesionales                     ┃
┃     Estado: ✅ Subido (25 ene)              ┃
┃     [Ver] [Reemplazar]                      ┃
┃                                             ┃
┃  📄 Business Plan                           ┃
┃     Estado: ✅ Subido (25 ene)              ┃
┃     [Ver] [Reemplazar]                      ┃
┃                                             ┃
┃  📄 Estudio Econométrico                    ┃
┃     Estado: Pendiente                       ┃
┃     [Seleccionar archivo] [Subir]           ┃
┃                                             ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  ✅ [Marcar Etapa 2 como Completada]        ┃
┃     (Envía notificación al cliente)         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Tab: Documentos

Vista consolidada de todos los documentos del caso.

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📁 TODOS LOS DOCUMENTOS                    ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  [Filtros: Todo | Cliente | URPE]           ┃
┃  [Buscar: _____________]                    ┃
┃                                             ┃
┃  📂 ETAPA 1                                 ┃
┃  ├─ ✅ Reporte de elegibilidad (URPE)       ┃
┃  ├─ ✅ Ruta personalizada (URPE)            ┃
┃  ├─ ✅ I-140 completado (URPE)              ┃
┃  └─ ✅ Manual DIY (URPE)                    ┃
┃                                             ┃
┃  📂 ETAPA 2                                 ┃
┃  ├─ ✅ CV_Juan.pdf (Cliente)                ┃
┃  ├─ ✅ Pasaporte_Juan.pdf (Cliente)         ┃
┃  ├─ ✅ Logos profesionales (URPE)           ┃
┃  ├─ ✅ Business Plan (URPE)                 ┃
┃  ├─ ⏳ Registro de patente (Pendiente)      ┃
┃  └─ ⏳ Estudio econométrico (Pendiente)     ┃
┃                                             ┃
┃  [📥 Descargar todos como .zip]             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Tab: Pagos

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💰 HISTORIAL DE PAGOS                      ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  Plan seleccionado: Opción 1 (Por etapas)   ┃
┃  Total: $16,997                             ┃
┃  Pagado: $1,500                             ┃
┃  Pendiente: $15,497                         ┃
┃                                             ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  📅 20 enero 2025                           ┃
┃  ✅ Pago completado: $1,500                 ┃
┃  Concepto: Etapa 2 - Creación de Empresa    ┃
┃  Método: Visa •••• 4242                     ┃
┃  ID Stripe: pi_xxxxx                        ┃
┃  [Ver recibo]                               ┃
┃                                             ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  [Generar reporte de pagos]                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Tab: Chat

Sistema de comunicación directa con el cliente.

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  💬 CHAT CON JUAN PÉREZ                     ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  [Historial de mensajes]                    ┃
┃                                             ┃
┃  👤 Juan (Ayer, 10:30am):                   ┃
┃  "Hola Diego, tengo una duda sobre el       ┃
┃   Business Plan en la página 15..."         ┃
┃                                             ┃
┃  👨‍💼 Diego (Ayer, 11:00am):                 ┃
┃  "Hola Juan, con gusto te ayudo. La         ┃
┃   sección de la página 15 se refiere a..."  ┃
┃                                             ┃
┃  👤 Juan (Hoy, 9:00am):                     ┃
┃  "Perfecto, muchas gracias!"                ┃
┃                                             ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  Escribe un mensaje:                        ┃
┃  ┌─────────────────────────────────────┐   ┃
┃  │                                     │   ┃
┃  └─────────────────────────────────────┘   ┃
┃  [📎 Adjuntar] [Enviar]                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Alertas y Notificaciones (Panel Admin)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🔔 NOTIFICACIONES Y ALERTAS                ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃                                             ┃
┃  ⚠️ Juan Pérez - CASE-789                   ┃
┃  Cliente aprobó expediente hace 2 días      ┃
┃  pero aún no se ha enviado a USCIS          ┃
┃  [Marcar como enviado]                      ┃
┃                                             ┃
┃  📥 María García - CASE-456                 ┃
┃  Cliente subió nuevo documento              ┃
┃  Hace 1 hora                                ┃
┃  [Ver documento]                            ┃
┃                                             ┃
┃  💬 Carlos Rodríguez - CASE-123             ┃
┃  Nuevo mensaje en chat                      ┃
┃  Hace 30 minutos                            ┃
┃  [Ver chat]                                 ┃
┃                                             ┃
┃  ⏰ Ana López - CASE-789                    ┃
┃  Recordatorio: Cita de revisión hoy 3:00pm  ┃
┃  [Ver detalles]                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 🔄 SISTEMA DE REVISIONES

### Cómo Funciona

Cada documento entregado por URPE puede ser revisado hasta 2 veces por el cliente sin costo adicional.

### Flujo de Revisión

```
ASESOR completa Etapa 2
    ↓
ASESOR sube 4 entregables:
  - Registro de patente
  - Logos profesionales
  - Business Plan
  - Estudio econométrico
    ↓
ASESOR hace clic en "Marcar como Completada"
    ↓
SISTEMA actualiza estado:
  - stage.status = "completed"
  - deliverables.status = "unlocked"
    ↓
SISTEMA envía notificación a CLIENTE
    ↓
CLIENTE entra al dashboard
    ↓
CLIENTE ve:
┌─────────────────────────────────────────┐
│ ✅ Etapa 2 Completada                   │
│ 📄 4 documentos listos para revisión    │
│                                         │
│ 📋 Business Plan                        │
│    [Ver] [Descargar] [💬 Comentar]      │
│    Revisiones restantes: 2/2            │
└─────────────────────────────────────────┘
    ↓
CLIENTE hace clic en [Ver]
    ↓
CLIENTE revisa el Business Plan
    ↓
CLIENTE no está satisfecho con página 15
    ↓
CLIENTE hace clic en [💬 Comentar]
    ↓
┌─────────────────────────────────────────┐
│ 💬 Comentarios - Business Plan          │
│                                         │
│ Revisiones restantes: 2/2               │
│                                         │
│ Escribe tus comentarios:                │
│ ┌─────────────────────────────────┐   │
│ │ En la página 15, por favor      │   │
│ │ ajustar el porcentaje de        │   │
│ │ crecimiento a 15% en vez de 10% │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [Enviar comentarios]                    │
│ [Aprobar sin cambios]                   │
└─────────────────────────────────────────┘
    ↓
CLIENTE hace clic en [Enviar comentarios]
    ↓
SISTEMA guarda comentario:
  - deliverables.comments.push({...})
  - deliverables.revision_count = 1
  - deliverables.status = "in_revision"
    ↓
SISTEMA notifica a ASESOR:
  📧 Email: "Juan solicitó cambios en Business Plan"
  🔔 Notificación en panel admin
    ↓
ASESOR ve notificación
    ↓
ASESOR lee comentario
    ↓
ASESOR hace ajuste al Business Plan
    ↓
ASESOR sube nueva versión: BusinessPlan_Juan_v2.pdf
    ↓
SISTEMA actualiza:
  - deliverables.file_url = "...v2.pdf"
  - deliverables.status = "unlocked"
    ↓
SISTEMA notifica a CLIENTE:
  📧 "Tu Business Plan ha sido actualizado"
    ↓
CLIENTE revisa nueva versión
    ↓
CLIENTE hace clic en [Ver]
    ↓
┌─────────────────────────────────────────┐
│ 📋 Business Plan (ACTUALIZADO)          │
│    [Ver] [Descargar] [💬 Comentar]      │
│    Revisiones restantes: 1/2            │
│                                         │
│    ✅ Última actualización: 27 ene, 2pm │
└─────────────────────────────────────────┘
    ↓
CLIENTE revisa y está satisfecho
    ↓
CLIENTE hace clic en [✅ Aprobar sin cambios]
    ↓
SISTEMA actualiza:
  - deliverables.status = "validated"
    ↓
CLIENTE aprueba los otros 3 documentos también
    ↓
SISTEMA verifica: todos los entregables validados
    ↓
SISTEMA desbloquea Etapa 3:
  - stage_3.status = "unlocked"
    ↓
CLIENTE ve: ✅ Etapa 3 Desbloqueada
```

### Límite de Revisiones Alcanzado

```
CLIENTE usó 2 revisiones en Business Plan
    ↓
CLIENTE quiere hacer otro cambio
    ↓
CLIENTE hace clic en [💬 Comentar]
    ↓
SISTEMA detecta: revision_count = 2 (máximo)
    ↓
SISTEMA muestra:
┌─────────────────────────────────────────┐
│ ⚠️ Límite de Revisiones Alcanzado       │
│                                         │
│ Has usado tus 2 revisiones incluidas.   │
│                                         │
│ Para cambios adicionales, agenda una    │
│ llamada con tu asesor.                  │
│                                         │
│ [📅 Agendar llamada]                    │
│ [✅ Aprobar documento actual]           │
└─────────────────────────────────────────┘
    ↓
CLIENTE tiene 2 opciones:
    ├─ Agendar llamada con asesor
    │  └─> Discutir cambios adicionales
    │       └─> Asesor puede hacer excepción manual
    │
    └─ Aprobar documento actual
       └─> Continuar sin más cambios
```

### Revisión Manual por Asesor

Si el cliente alcanzó el límite pero realmente necesita un cambio:

```
CLIENTE agenda llamada con ASESOR
    ↓
En la llamada:
  ASESOR evalúa si el cambio es razonable
    ↓
  Si SÍ:
    ASESOR hace el cambio manualmente
    ASESOR sube nueva versión
    ASESOR marca como "validated" sin contar revisión
    ↓
  Si NO:
    ASESOR explica por qué no es necesario
    ASESOR ofrece alternativa
```

---

## 💳 PAGOS Y DESBLOQUEO DE ETAPAS

### Estructura de Precios

```
═══════════════════════════════════════════════════════════
INVERSIÓN TOTAL: $16,997
═══════════════════════════════════════════════════════════

PAGO INICIAL REQUERIDO: $6,790
RESTO FINANCIADO: $10,207

═══════════════════════════════════════════════════════════
```

### Opciones de Pago

**OPCIÓN 1: Pago Inicial por Etapas**
```
El cliente puede dividir los $6,790 entre las etapas 2-6

Ejemplo:
  Etapa 2: $1,500
  Etapa 3: $1,500
  Etapa 4: $1,500
  Etapa 5: $1,145
  Etapa 6: $1,145
  ─────────────
  Total: $6,790

Resto: $10,207 → Financiado
```

**OPCIÓN 1B: Inicial Adelantada (Black Friday)**
```
Pago inicial completo HOY:
  $6,790 → $5,497
  ✨ AHORRAS: $1,293

Beneficios:
  + 🚀 Fast-Track Priority
  + ⚡ Expediente se procesa primero
  + 📅 Radicación más rápida

Resto: $10,207 → Financiado
```

**OPCIÓN 2: Todo Adelantado (Mejor Precio)**
```
Pago completo HOY:
  $16,997 → $14,997
  ✨ AHORRAS: $2,000

Beneficios:
  + 🚀 Fast-Track Priority
  + 🔄 Revisiones ilimitadas
  + 🎯 Atención prioritaria
  + 💰 Sin preocupaciones de pagos futuros
```

### Flujo de Pago

```
CLIENTE en Dashboard
    ↓
CLIENTE selecciona plan de pago
    ↓
SISTEMA guarda:
  visa_cases.payment_plan = "option_1"
    ↓
CLIENTE ve Etapa 2
    ↓
┌─────────────────────────────────────────┐
│ 🔒 ETAPA 2: CREACIÓN DE EMPRESA         │
│                                         │
│ Para desbloquear esta etapa:            │
│ 💰 Pago requerido: $1,500               │
│                                         │
│ [💳 Pagar ahora]                        │
└─────────────────────────────────────────┘
    ↓
CLIENTE hace clic en [💳 Pagar ahora]
    ↓
FRONTEND solicita al BACKEND crear intención de pago
    ↓
BACKEND crea intención en Stripe:
  stripe.paymentIntents.create({
    amount: 150000, // $1,500 en centavos
    currency: "usd",
    customer: "cus_xxxxx",
    metadata: {
      case_id: "uuid-456",
      stage_number: 2,
      user_id: "uuid-123"
    }
  })
    ↓
BACKEND retorna al FRONTEND:
  {
    "client_secret": "pi_xxxxx_secret_xxxxx",
    "payment_intent_id": "pi_xxxxx"
  }
    ↓
FRONTEND muestra formulario de pago de Stripe:
┌─────────────────────────────────────────┐
│ 💳 Información de Pago                  │
│                                         │
│ Monto: $1,500.00 USD                    │
│                                         │
│ Número de tarjeta:                      │
│ [________________]                      │
│                                         │
│ MM/YY  CVC                              │
│ [____] [___]                            │
│                                         │
│ [Pagar $1,500]                          │
└─────────────────────────────────────────┘
    ↓
CLIENTE llena datos de tarjeta
    ↓
CLIENTE hace clic en [Pagar]
    ↓
FRONTEND envía a Stripe (seguro, encriptado)
    ↓
STRIPE procesa el pago
    ↓
═══════════════════════════════════════════

CASO 1: PAGO EXITOSO ✅
    ↓
STRIPE retorna: status = "succeeded"
    ↓
FRONTEND notifica al BACKEND:
  {
    "payment_intent_id": "pi_xxxxx",
    "case_id": "uuid-456",
    "stage_number": 2
  }
    ↓
BACKEND verifica con Stripe:
  stripe.paymentIntents.retrieve("pi_xxxxx")
    ↓
BACKEND confirma: status = "succeeded"
    ↓
BACKEND actualiza MongoDB:
  
  payments.insert({
    "payment_id": "uuid-303",
    "case_id": "uuid-456",
    "amount": 1500.0,
    "status": "completed",
    "stripe_payment_id": "pi_xxxxx",
    "stage_number": 2,
    "completed_at": "2025-01-20T10:05:00Z"
  })
  
  visa_cases.update({
    "case_id": "uuid-456"
  }, {
    $inc: { "paid_amount": 1500.0 }
  })
  
  stages.update({
    "case_id": "uuid-456",
    "stage_number": 2
  }, {
    $set: {
      "status": "unlocked",
      "is_paid": true
    }
  })
    ↓
BACKEND envía notificación:
  📧 Email a cliente: "¡Etapa 2 desbloqueada!"
  🔔 Notificación en dashboard
    ↓
FRONTEND recibe confirmación
    ↓
FRONTEND muestra:
┌─────────────────────────────────────────┐
│ ✅ ¡Pago Exitoso!                       │
│                                         │
│ Etapa 2 ha sido desbloqueada.           │
│                                         │
│ Ahora puedes subir tus documentos.      │
│                                         │
│ [Ir a Etapa 2]                          │
└─────────────────────────────────────────┘

═══════════════════════════════════════════

CASO 2: PAGO RECHAZADO ❌
    ↓
STRIPE retorna: status = "requires_payment_method"
    ↓
FRONTEND muestra:
┌─────────────────────────────────────────┐
│ ❌ Pago Rechazado                       │
│                                         │
│ Tu tarjeta fue declinada.               │
│                                         │
│ Posibles razones:                       │
│ • Fondos insuficientes                  │
│ • Datos incorrectos                     │
│ • Tarjeta bloqueada                     │
│                                         │
│ [Intentar otra tarjeta]                 │
│ [Contactar soporte]                     │
└─────────────────────────────────────────┘
    ↓
BACKEND NO desbloquea la etapa
    ↓
BACKEND registra intento fallido:
  payments.insert({
    "payment_id": "uuid-304",
    "case_id": "uuid-456",
    "amount": 1500.0,
    "status": "failed",
    "stripe_payment_id": "pi_xxxxx",
    "stage_number": 2,
    "error_message": "Card declined"
  })

═══════════════════════════════════════════

CASO 3: PAGO PENDIENTE ⏳
    ↓
STRIPE retorna: status = "processing"
    ↓
FRONTEND muestra:
┌─────────────────────────────────────────┐
│ ⏳ Pago Procesándose                    │
│                                         │
│ Tu pago está siendo verificado.         │
│ Esto puede tomar algunos minutos.       │
│                                         │
│ Te notificaremos cuando se confirme.    │
│                                         │
│ [Volver al dashboard]                   │
└─────────────────────────────────────────┘
    ↓
BACKEND marca pago como pendiente:
  payments.insert({
    "payment_id": "uuid-305",
    "case_id": "uuid-456",
    "amount": 1500.0,
    "status": "pending",
    "stripe_payment_id": "pi_xxxxx",
    "stage_number": 2
  })
    ↓
STRIPE webhook notifica cuando se confirme
    ↓
BACKEND recibe webhook:
  POST /api/webhooks/stripe
  {
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_xxxxx",
        "status": "succeeded"
      }
    }
  }
    ↓
BACKEND actualiza pago:
  payments.update({
    "stripe_payment_id": "pi_xxxxx"
  }, {
    $set: {
      "status": "completed",
      "completed_at": "2025-01-20T10:15:00Z"
    }
  })
    ↓
BACKEND desbloquea etapa (igual que CASO 1)
    ↓
BACKEND notifica a cliente

═══════════════════════════════════════════
```

### Seguridad de Pagos

**Protecciones implementadas:**
1. **PCI-DSS Compliance:** Stripe maneja toda la información sensible
2. **Datos nunca en nuestro servidor:** Números de tarjeta nunca tocan nuestro backend
3. **Encriptación SSL:** Toda comunicación es HTTPS
4. **Verificación 3D Secure:** Autenticación adicional cuando es requerida
5. **Detección de fraude:** Stripe analiza cada transacción
6. **Webhooks firmados:** Verificamos que vengan de Stripe

---

## 🔔 NOTIFICACIONES

### Tipos de Notificaciones

**1. Email**
- Enviado a la dirección registrada del usuario
- Formato HTML con diseño de marca URPE

**2. WhatsApp**
- Enviado al teléfono registrado
- Mensajes cortos con link al dashboard

**3. Dashboard**
- Campana de notificaciones en el header
- Lista de notificaciones no leídas

**4. Push (Opcional - Futuro)**
- Notificaciones del navegador
- Solo si el usuario da permiso

### Eventos que Generan Notificaciones

**Para el CLIENTE:**

| Evento | Email | WhatsApp | Dashboard |
|--------|-------|----------|-----------|
| Etapa completada | ✅ | ✅ | ✅ |
| Documento actualizado (después de revisión) | ✅ | ✅ | ✅ |
| Etapa desbloqueada | ✅ | ✅ | ✅ |
| Pago confirmado | ✅ | ❌ | ✅ |
| Pago rechazado | ✅ | ❌ | ✅ |
| Nuevo mensaje del asesor | ✅ | ❌ | ✅ |
| Recordatorio de cita (24h antes) | ✅ | ✅ | ✅ |
| Expediente enviado a USCIS | ✅ | ✅ | ✅ |
| Receipt Notice recibido | ✅ | ✅ | ✅ |

**Para el ASESOR:**

| Evento | Email | Dashboard |
|--------|-------|-----------|
| Cliente subió documento | ✅ | ✅ |
| Cliente hizo comentario en entregable | ✅ | ✅ |
| Cliente aprobó todos los entregables | ✅ | ✅ |
| Nuevo pago recibido | ✅ | ✅ |
| Nuevo mensaje del cliente | ✅ | ✅ |
| Cliente aprobó expediente final | ✅ | ✅ |

### Contenido de Notificaciones

**Ejemplo: Etapa Completada**

**Email:**
```
Asunto: ¡Etapa 2 Completada! - URPE

Hola Juan,

¡Excelentes noticias! Tu Etapa 2 (Creación de Empresa) está lista.

Hemos preparado los siguientes documentos para ti:
✅ Registro de Patente
✅ Logos Profesionales
✅ Business Plan (125 páginas)
✅ Estudio Econométrico (45 páginas)

Por favor, revisa cada documento y déjanos tus comentarios si es necesario.
Tienes hasta 2 revisiones por documento sin costo adicional.

[Ver documentos en tu dashboard]

Si tienes dudas, agenda una llamada con tu asesor Diego Urquijo.

[Agendar llamada de revisión]

Saludos,
Equipo URPE
```

**WhatsApp:**
```
¡Hola Juan! 🎉

Tu Etapa 2 está lista. Revisa tus documentos aquí:
https://urpe.com/dashboard/stages/2

Equipo URPE
```

**Dashboard:**
```
┌─────────────────────────────────────────┐
│ 🔔 Notificaciones (1 nueva)             │
│                                         │
│ ✅ Etapa 2 Completada                   │
│    Hace 5 minutos                       │
│    Tus documentos están listos.         │
│    [Ver documentos]                     │
└─────────────────────────────────────────┘
```

---

## ⚠️ ERRORES COMUNES Y SOLUCIONES

### Errores del Cliente

#### 1. Link Mágico Inválido o Expirado

**Síntomas:**
- Al hacer clic en el link, ve mensaje de error
- "Link inválido" o "Link expirado"

**Causas:**
- Pasaron más de 30 días desde que se generó
- Link fue manipulado o copiado incorrectamente
- Ya se registró previamente con ese link

**Soluciones:**
1. Verificar que copió el link completo
2. Si expiró: Contactar soporte para generar nuevo link
3. Si ya se registró: Ir a "Iniciar sesión"

---

#### 2. No Puede Registrarse (Email Ya Existe)

**Síntomas:**
- Al intentar registrarse: "Email ya registrado"

**Causas:**
- Ese email ya fue usado por otra persona
- Ya se registró antes y lo olvidó

**Soluciones:**
1. Usar otro email
2. Intentar "Iniciar sesión" con ese email
3. Usar "Olvidé mi contraseña" si no recuerda

---

#### 3. No Puede Subir Archivo

**Síntomas:**
- "Archivo muy grande"
- "Formato no permitido"
- Error al subir

**Causas:**
- Archivo mayor a 10 MB
- Formato incorrecto (no es PDF/JPG/PNG)
- Conexión de internet inestable
- Archivo corrupto

**Soluciones:**
1. Comprimir el archivo (usar herramientas en línea)
2. Convertir a formato permitido
3. Verificar conexión de internet
4. Intentar desde otro dispositivo

---

#### 4. No Puede Ver Documento

**Síntomas:**
- Mensaje: "Error al cargar documento"
- Página en blanco al hacer clic en "Ver"

**Causas:**
- Link del archivo expiró
- Archivo fue movido o borrado
- Problema de permisos

**Soluciones:**
1. Intentar "Descargar" en vez de "Ver"
2. Refrescar la página (F5)
3. Contactar a su asesor para que revise

---

#### 5. Pago Rechazado

**Síntomas:**
- "Tarjeta declinada"
- "Pago no pudo ser procesado"

**Causas:**
- Fondos insuficientes
- Tarjeta vencida
- Datos incorrectos
- Tarjeta bloqueada por el banco

**Soluciones:**
1. Verificar saldo de la tarjeta
2. Verificar fecha de vencimiento
3. Intentar con otra tarjeta
4. Contactar al banco
5. Contactar soporte URPE

---

#### 6. Sesión Expirada

**Síntomas:**
- Fue redirigido a login inesperadamente
- "Sesión expirada, inicia sesión"

**Causas:**
- Token JWT expiró (después de 30 días)
- Navegador borró cookies
- Cerró sesión en otro dispositivo

**Soluciones:**
1. Simplemente iniciar sesión de nuevo
2. Si olvidó contraseña: usar "Olvidé mi contraseña"

---

### Errores del Asesor

#### 7. No Puede Descargar Documento del Cliente

**Síntomas:**
- Error al hacer clic en "Descargar"
- Archivo no encontrado

**Causas:**
- Archivo fue borrado accidentalmente
- Permisos incorrectos
- Link expirado

**Soluciones:**
1. Refrescar la página
2. Contactar soporte técnico
3. Solicitar al cliente que suba el archivo nuevamente

---

#### 8. Cliente No Ve Entregables Subidos

**Síntomas:**
- Asesor subió archivos pero cliente no los ve
- Cliente no recibió notificación

**Causas:**
- Etapa no fue marcada como "completada"
- Error al enviar notificación
- Cliente no refrescó la página

**Soluciones:**
1. Verificar que se marcó como "completada"
2. Reenviar notificación manualmente
3. Contactar al cliente directamente (chat/email)
4. Pedirle que refresque la página

---

#### 9. Caso No Aparece en Panel Admin

**Síntomas:**
- Asesor no ve caso que debería estar asignado

**Causas:**
- Caso asignado a otro asesor
- Error en la sincronización
- Cliente aún no se registró (solo está en Supabase)

**Soluciones:**
1. Verificar asignación en base de datos
2. Esperar a que cliente se registre
3. Reasignar caso manualmente

---

### Errores del Sistema

#### 10. Supabase y MongoDB Desincronizados

**Síntomas:**
- Cliente registrado en MongoDB pero `is_converted = false` en Supabase
- Datos inconsistentes entre las dos bases

**Causas:**
- Fallo en la transacción durante registro
- Error de red durante actualización

**Soluciones:**
1. Script de sincronización automático cada hora
2. Panel admin para corregir manualmente
3. Logs detallados para detectar el error

---

#### 11. Notificación No Enviada

**Síntomas:**
- Email no llega
- WhatsApp no se envía
- Notificación no aparece en dashboard

**Causas:**
- Servidor de email caído
- API de WhatsApp no disponible
- Email en spam
- Número de teléfono incorrecto

**Soluciones:**
1. Reintentar envío automáticamente (3 intentos)
2. Registrar en logs el fallo
3. Panel admin muestra notificaciones fallidas
4. Opción manual de reenvío

---

#### 12. Webhook de Stripe Falla

**Síntomas:**
- Pago se completó pero etapa no se desbloqueó
- Pago en Stripe dice "succeeded" pero en URPE dice "pending"

**Causas:**
- Webhook no llegó al backend
- Backend estaba caído cuando llegó
- Webhook rechazado por error

**Soluciones:**
1. Stripe reintenta enviar webhook automáticamente
2. Script que verifica pagos pendientes cada hora
3. Panel admin permite confirmar pagos manualmente
4. Logs de webhooks para debuggear

---

## 🔒 SEGURIDAD

### Autenticación y Autorización

**JWT Tokens:**
- Expiración: 30 días
- Renovación: Automática al iniciar sesión
- Almacenamiento: localStorage (frontend)
- Firma: HMAC SHA256

**Contraseñas:**
- Hasheadas con bcrypt (factor 12)
- Nunca se almacenan en texto plano
- Validación de fortaleza en frontend y backend

**Sesiones:**
- Cada sesión tiene un token único
- Tokens invalidados al cambiar contraseña
- Logout limpia todos los tokens

### Permisos y Roles

| Rol | Puede |
|-----|-------|
| U1 (Guest) | Ver reporte, ver ruta, NO descargar |
| U3 (Registrado) | Todo lo anterior + completar etapas |
| Asesor | Ver/editar casos asignados, subir entregables |
| Admin | Todo lo anterior + gestionar usuarios/asesores |

### Protección de Datos

**GDPR / CCPA Compliance:**
- Datos encriptados en tránsito (HTTPS/TLS 1.3)
- Datos sensibles encriptados en reposo
- Derecho al olvido (eliminar datos)
- Exportar datos personales (formato JSON)

**Backups:**
- MongoDB: Backup diario automático
- Supabase: Backup automático (proveedor)
- S3: Versionado activado
- Retención: 30 días

**Auditoría:**
- Logs de todas las acciones críticas
- Registro de accesos
- Cambios en datos sensibles
- Intentos de acceso fallidos

### Protección contra Ataques

**SQL Injection:**
- MongoDB no es vulnerable a SQL injection
- Validación de entrada en backend

**XSS (Cross-Site Scripting):**
- React escapa contenido automáticamente
- Sanitización de HTML en backend

**CSRF (Cross-Site Request Forgery):**
- Tokens CSRF en formularios
- Same-Site cookies

**DDoS:**
- Rate limiting (100 requests/min por IP)
- Cloudflare protection

**Fuerza Bruta:**
- Límite de intentos de login (5 fallos = bloqueo 15 min)
- CAPTCHA después de 3 intentos

---

## 📚 GLOSARIO DE TÉRMINOS

**Backend:** Parte del sistema que no ve el usuario, donde se procesa la lógica y se guardan los datos.

**Dashboard:** Página principal donde el usuario ve su información y gestiona su caso.

**Deliverable (Entregable):** Documento o archivo que URPE entrega al cliente.

**EB-2 NIW:** Tipo de visa estadounidense (Employment-Based Second Preference - National Interest Waiver).

**Frontend:** Parte visual del sistema que el usuario ve en su navegador.

**JWT (JSON Web Token):** Token de seguridad que identifica a un usuario autenticado.

**Link Mágico:** URL única que permite acceso sin contraseña.

**MongoDB:** Base de datos principal donde se guarda toda la información operativa.

**Prospecto:** Persona que completó la evaluación inicial pero aún no se ha registrado.

**Receipt Notice:** Documento oficial de USCIS que confirma que recibieron la petición.

**Stage (Etapa):** Cada una de las 7 fases del proceso EB-2 NIW.

**Supabase:** Base de datos auxiliar para prospectos iniciales.

**Token:** Código único y secreto que identifica algo (usuario, link, etc.).

**U1 (Usuario Tipo 1):** Usuario invitado/guest, no registrado.

**U3 (Usuario Tipo 3):** Usuario registrado completo con cuenta.

**USCIS:** United States Citizenship and Immigration Services (autoridad de inmigración USA).

---

## 📝 NOTAS FINALES

### Consideraciones Importantes

1. **Testing:** Todo cambio debe ser probado en ambiente de desarrollo antes de producción.

2. **Documentación:** Este documento debe actualizarse cada vez que se agregue funcionalidad nueva.

3. **Backups:** Verificar backups semanalmente.

4. **Monitoreo:** Revisar logs diariamente para detectar errores.

5. **Soporte:** Tiempo de respuesta máximo: 24 horas.

### Próximas Mejoras (Roadmap)

- [ ] Notificaciones push del navegador
- [ ] App móvil nativa (iOS/Android)
- [ ] Chat en tiempo real (WebSockets)
- [ ] Videollamadas integradas
- [ ] Firma electrónica de documentos
- [ ] Traducción automática de formularios
- [ ] Dashboard de métricas para asesores
- [ ] Sistema de referidos

---

**Fin de la documentación**

_Última actualización: Enero 2025_
_Contacto: soporte@urpe.com_
