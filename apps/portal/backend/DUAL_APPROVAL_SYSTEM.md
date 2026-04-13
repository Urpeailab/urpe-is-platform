# Sistema de Aprobación Dual para Eliminación de Super Admins

## 🔐 Concepto de Seguridad

El sistema implementa un **control dual** (two-man rule) para la eliminación de super admins, garantizando que ningún super admin pueda eliminar a otro unilateralmente.

## 📋 Flujo del Sistema

### 1️⃣ Crear Super Admin
```
Super Admin A → Crea → Super Admin B
✅ Permitido directamente
```

**Endpoint:** `POST /api/admin/staff/create-admin`
```json
{
  "email": "nuevo.admin@urpe.com",
  "name": "Nuevo Admin",
  "password": "contraseña_segura"
}
```

### 2️⃣ Solicitar Eliminación
```
Super Admin A → Solicita eliminar → Super Admin B
⚠️ Crea solicitud pendiente (no elimina directamente)
```

**Endpoint:** `POST /api/admin/staff/request-delete/{staff_id}`
```json
{
  "reason": "Razón de la eliminación"
}
```

**Validaciones:**
- ❌ No puedes solicitar eliminar tu propia cuenta
- ✅ Se crea una solicitud con estado "pending"
- ⏱️ La solicitud expira en 7 días

### 3️⃣ Ver Solicitudes Pendientes
```
Cualquier Super Admin → Ve → Todas las solicitudes
```

**Endpoint:** `GET /api/admin/staff/deletion-requests?status=pending`

**Respuesta:**
```json
{
  "requests": [
    {
      "_id": "request-123",
      "staffId": "admin-456",
      "staffEmail": "admin@urpe.com",
      "staffName": "Admin a Eliminar",
      "requestedBy": {
        "id": "admin-789",
        "email": "solicitante@urpe.com",
        "name": "Admin Solicitante"
      },
      "reason": "Ya no trabaja en la empresa",
      "status": "pending",
      "createdAt": "2025-12-05T10:00:00Z",
      "expiresAt": "2025-12-12T10:00:00Z",
      "isExpired": false
    }
  ]
}
```

### 4️⃣ Aprobar Eliminación
```
Super Admin C (diferente) → Aprueba → Elimina Super Admin B
✅ Solo si es un admin DIFERENTE al que solicitó
```

**Endpoint:** `POST /api/admin/staff/deletion-requests/{request_id}/approve`

**Validaciones Críticas:**
- ❌ No puedes aprobar tu propia solicitud
- ❌ No puedes aprobar si la solicitud expiró
- ❌ No puedes aprobar si ya fue aprobada/rechazada
- ✅ Solo entonces se elimina el admin

### 5️⃣ Rechazar Eliminación
```
Cualquier Super Admin → Rechaza → Solicitud cancelada
```

**Endpoint:** `POST /api/admin/staff/deletion-requests/{request_id}/reject`
```json
{
  "reason": "Razón del rechazo"
}
```

---

## 🛡️ Reglas de Seguridad

### ✅ Permitido:
1. ✅ Super Admin A crea Super Admin B
2. ✅ Super Admin A solicita eliminar Super Admin B
3. ✅ Super Admin C aprueba la solicitud
4. ✅ Super Admin B es eliminado

### ❌ Bloqueado:
1. ❌ Super Admin A elimina directamente a Super Admin B
2. ❌ Super Admin A solicita eliminarse a sí mismo
3. ❌ Super Admin A aprueba su propia solicitud
4. ❌ Aprobar solicitud expirada (>7 días)

---

## 📊 Estados de Solicitud

| Estado | Descripción |
|--------|-------------|
| `pending` | Esperando aprobación de otro admin |
| `approved` | Aprobada y admin eliminado |
| `rejected` | Rechazada por otro admin |

---

## 🔄 Flujo Completo de Ejemplo

### Escenario: Eliminar Admin "Juan"

**1. Solicitud:**
```bash
POST /api/admin/staff/request-delete/juan-id
Authorization: Bearer [token-admin-maria]
{
  "reason": "Juan dejó la empresa"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Solicitud de eliminación creada. Requiere aprobación de otro super admin.",
  "requestId": "req-abc123",
  "expiresAt": "2025-12-12T10:00:00Z"
}
```

**2. Otro Admin Ve Solicitudes:**
```bash
GET /api/admin/staff/deletion-requests?status=pending
Authorization: Bearer [token-admin-carlos]
```

**3. Carlos Aprueba:**
```bash
POST /api/admin/staff/deletion-requests/req-abc123/approve
Authorization: Bearer [token-admin-carlos]
```

**Resultado:**
```json
{
  "success": true,
  "message": "Admin eliminado exitosamente",
  "deletedAdmin": {
    "email": "juan@urpe.com",
    "name": "Juan"
  }
}
```

---

## 📝 Colección MongoDB

**Nombre:** `admin_deletion_requests`

**Esquema:**
```javascript
{
  _id: "request-uuid",
  staffId: "admin-uuid",           // Admin a eliminar
  staffEmail: "admin@urpe.com",
  staffName: "Admin Name",
  staffRole: "admin",
  requestedBy: {                   // Quien solicitó
    id: "requester-uuid",
    email: "requester@urpe.com",
    name: "Requester Name"
  },
  reason: "Motivo de eliminación",
  status: "pending",               // pending | approved | rejected
  createdAt: ISODate(),
  expiresAt: ISODate(),           // +7 días desde creación
  
  // Si fue aprobada:
  approvedBy: {
    id: "approver-uuid",
    email: "approver@urpe.com",
    name: "Approver Name"
  },
  approvedAt: ISODate(),
  
  // Si fue rechazada:
  rejectedBy: { ... },
  rejectionReason: "Motivo rechazo",
  rejectedAt: ISODate()
}
```

---

## 🔍 Logs de Actividad

Todas las acciones quedan registradas en `activity_log`:

1. **Create Admin:**
```json
{
  "action": "create",
  "resource": "staff",
  "details": { "role": "admin", "email": "..." }
}
```

2. **Request Delete:**
```json
{
  "action": "request_delete",
  "resource": "staff",
  "details": { "requestId": "...", "targetEmail": "..." }
}
```

3. **Approve Delete:**
```json
{
  "action": "delete_approved",
  "resource": "staff",
  "details": { "deletedEmail": "...", "requestedBy": "..." }
}
```

4. **Reject Delete:**
```json
{
  "action": "delete_rejected",
  "resource": "staff",
  "details": { "requestId": "...", "reason": "..." }
}
```

---

## 🎯 Endpoints Completos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/admin/staff/create-admin` | Crear super admin |
| POST | `/api/admin/staff/request-delete/{staff_id}` | Solicitar eliminación |
| GET | `/api/admin/staff/deletion-requests` | Ver solicitudes |
| POST | `/api/admin/staff/deletion-requests/{id}/approve` | Aprobar |
| POST | `/api/admin/staff/deletion-requests/{id}/reject` | Rechazar |

---

## ✅ Beneficios de Seguridad

1. **No hay eliminación unilateral** - Se requieren 2 admins
2. **Trazabilidad completa** - Todos los logs quedan registrados
3. **Protección contra insider threats** - Nadie puede eliminar sin supervisión
4. **Tiempo de reflexión** - 7 días para revisar la solicitud
5. **Auditoría clara** - Quién solicitó, quién aprobó, cuándo

---

## 🚨 Casos de Emergencia

Si necesitas eliminar un admin urgentemente:
1. Admin A crea la solicitud
2. Admin B la aprueba inmediatamente
3. Todo queda registrado en logs

**Nota:** No hay bypass del sistema de aprobación dual por seguridad.
