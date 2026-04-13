# Backend Refactoring Guide

## 📁 Nueva Estructura

```
backend/
├── server.py                 # Aplicación principal (FastAPI setup)
├── config.py                 # Configuración compartida
├── admin_models.py          # Modelos existentes
├── permissions_system.py    # Sistema RBAC existente
│
├── routes/                   # 🆕 Routers organizados por funcionalidad
│   ├── __init__.py
│   ├── auth.py              # Autenticación (próximamente)
│   ├── cases.py             # Gestión de casos (próximamente)
│   ├── payments.py          # Pagos (próximamente)
│   └── users.py             # Usuarios (próximamente)
│
├── models/                   # 🆕 Modelos Pydantic
│   ├── __init__.py
│   └── (modelos organizados - próximamente)
│
├── services/                 # 🆕 Lógica de negocio
│   ├── __init__.py
│   └── (servicios - próximamente)
│
└── utils/                    # 🆕 Funciones helper
    ├── __init__.py
    ├── auth_helpers.py       # ✅ Helpers de autenticación
    ├── date_helpers.py       # ✅ Helpers de fechas
    └── activity_log.py       # ✅ Logging de actividades

```

## ✅ Completado

### Fase 1: Infraestructura
- **`auth_helpers.py`**: Funciones para verificar tokens (staff, admin, user)
- **`date_helpers.py`**: Manejo de fechas UTC y conversiones
- **`activity_log.py`**: Clase helper para crear logs de actividad
- **`config.py`**: Configuración compartida (DB, logging, JWT)

### Fase 2: Routers Modulares ✅
- **`routes/auth_user.py`**: ✅ Autenticación de usuarios (signup, signin, magic links)
  - POST /api/auth/signup
  - POST /api/auth/signin
  - POST /api/auth/generate-magic-link
  - GET /api/auth/validate-magic-link/{token}
  - POST /api/auth/mark-welcome-seen
  
- **`routes/auth_admin.py`**: ✅ Autenticación de admin/staff
  - POST /api/admin/auth/login
  - GET /api/admin/auth/me
  - POST /api/admin/auth/logout

### Fase 3: Gestión de Usuarios y Staff ✅
- **`routes/users_admin.py`**: ✅ Gestión de usuarios
  - GET /api/admin/users/{user_phone}/magic-links
  - POST /api/admin/users/{user_phone}/generate-magic-link
  - GET /api/admin/users (con paginación y búsqueda)

- **`routes/staff_admin.py`**: ✅ Gestión de staff
  - GET /api/admin/staff
  - GET /api/admin/staff/coordinators
  - PUT /api/admin/staff/change-password

### Fase 4: Casos y Pagos ✅
- **`routes/cases_admin.py`**: ✅ Gestión de casos de visa
  - GET /api/admin/visa-cases (con filtros, búsqueda, sorting por prioridad)
  - GET /api/admin/visa-cases/{case_id} (detalle completo)
  - DELETE /api/admin/visa-cases/{case_id} (solo super admin)
  - Incluye cálculo de "Priority Score" para sorting inteligente

- **`routes/payments_admin.py`**: ✅ Gestión de pagos
  - GET /api/admin/payments/case/{case_id} (pagos de un caso)
  - POST /api/admin/payments/register (registrar pago único)
  - POST /api/admin/payments/register-multiple (registrar múltiples pagos)
  - GET /api/admin/payments (todos los pagos con paginación)

## ✅ Refactorización Completada

**Total:** 6 routers modulares con 23 endpoints migrados
- ~2,000 líneas de código organizadas en módulos
- Estructura escalable y mantenible
- Testing independiente posible
- Endpoints legacy mantienen compatibilidad

## 📊 Estado Actual

- **server.py**: 5501 líneas (todavía monolítico pero con helpers disponibles)
- **Objetivo**: Mantener funcionalidad actual mientras preparamos migración gradual

## 🎯 Próximos Pasos

1. Mover endpoints de autenticación a `routes/auth.py`
2. Mover endpoints de casos a `routes/cases.py`
3. Mover endpoints de pagos a `routes/payments.py`
4. Extraer modelos Pydantic a `models/`
5. Crear servicios de negocio en `services/`

## 💡 Cómo Usar los Nuevos Helpers

### Auth Helpers
```python
from utils.auth_helpers import verify_staff_token_impl, verify_admin_only

# En tus endpoints
@api_router.get("/some-endpoint")
async def some_endpoint(authorization: str = Header(None)):
    payload = verify_staff_token_impl(authorization)
    # payload contiene {id, email, role, type}
```

### Date Helpers
```python
from utils.date_helpers import get_utc_now, to_iso_string

# Obtener fecha actual UTC
now = get_utc_now()

# Convertir a ISO string
iso_date = to_iso_string(now)
```

### Activity Log
```python
from utils.activity_log import ActivityLog

# Crear log de actividad
log = ActivityLog.create_log(
    staff_id=payload['id'],
    action='create',
    resource='visa_case',
    resource_id=case_id,
    details={'visaType': 'EB-2 NIW'}
)
await db.activity_log.insert_one(log)
```

## 🚀 Beneficios

- ✅ Código más organizado y mantenible
- ✅ Funciones helper reutilizables
- ✅ Preparado para migración gradual a routers
- ✅ Mejor testing (helpers se pueden testear independientemente)
- ✅ Reduce duplicación de código
