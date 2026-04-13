# 🔄 Diagrama de Flujo: Sistema de Pagos Manuales

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Usuario)                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 1. Ve etapa bloqueada
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  "Pago Pendiente"            │
                    │  Botón: "Agendar Cita"       │
                    └──────────────────────────────┘
                                   │
                                   │ 2. Click en "Agendar Cita"
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  📅 Modal de Calendario       │
                    │  - Selecciona fecha          │
                    │  - Agrega notas              │
                    │  - Envía solicitud           │
                    └──────────────────────────────┘
                                   │
                                   │ 3. Cita creada (status: pending)
                                   │
═══════════════════════════════════════════════════════════════════════
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ADMIN (Coordinadora)                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 4. Ve cita en dashboard
                                   │
                    ┌──────────────────────────────┐
                    │  /admin/appointments          │
                    │  - Lista de citas pendientes  │
                    │  - Botón: "Confirmar Cita"   │
                    └──────────────────────────────┘
                                   │
                                   │ 5. Confirma cita y agenda
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  ✅ Cita confirmada           │
                    │  - Fecha confirmada           │
                    │  - Link de reunión           │
                    │  (status: confirmed)         │
                    └──────────────────────────────┘
                                   │
                                   │ 6. Reunión realizada
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  Cliente realiza el pago     │
                    │  (fuera del sistema)         │
                    │  - Transferencia             │
                    │  - Efectivo                  │
                    │  - Zelle, etc.               │
                    └──────────────────────────────┘
                                   │
                                   │ 7. Admin recibe confirmación
                                   │
═══════════════════════════════════════════════════════════════════════
                                   │
                                   ▼
        ╔══════════════════════════════════════════════════╗
        ║   🎯 AQUÍ ES DONDE REGISTRAS EL PAGO            ║
        ╚══════════════════════════════════════════════════╝
                                   │
                    ┌──────────────┴──────────────┐
                    │                              │
                    ▼                              ▼
        ┌─────────────────────┐      ┌─────────────────────┐
        │  OPCIÓN 1           │      │  OPCIÓN 2           │
        │  (Recomendado)       │      │  (Desde caso)       │
        └─────────────────────┘      └─────────────────────┘
                    │                              │
                    ▼                              ▼
    ┌───────────────────────────┐  ┌───────────────────────────┐
    │ /admin/manual-payments     │  │ /admin/visa-cases/:id     │
    │                            │  │ Tab "Pagos"               │
    │ Botón verde:               │  │ Botón verde:              │
    │ "Registrar Pago"           │  │ "Registrar Nuevo Pago"    │
    └───────────────────────────┘  └───────────────────────────┘
                    │                              │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  📋 MODAL: Registrar Pago    │
                    │  Manual                       │
                    │                               │
                    │  Campos OBLIGATORIOS:        │
                    │  ✅ Caso                      │
                    │  ✅ Etapa                     │
                    │  ✅ Monto                     │
                    │  ✅ Fecha de Pago             │
                    │  ✅ Método de Pago            │
                    │                               │
                    │  Campos OPCIONALES:          │
                    │  📎 Referencia/ID             │
                    │  📎 Comprobante (PDF/imagen)  │
                    │  📎 Notas                     │
                    └──────────────────────────────┘
                                   │
                                   │ 8. Click "Registrar Pago"
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  🔄 BACKEND PROCESSING        │
                    │                               │
                    │  1. Valida datos              │
                    │  2. Sube comprobante (si hay) │
                    │  3. Registra pago en DB       │
                    │  4. DESBLOQUEA etapa          │
                    │  5. Marca citas como          │
                    │     completadas               │
                    └──────────────────────────────┘
                                   │
                                   │ 9. Éxito
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  ✅ Pago Registrado           │
                    │                               │
                    │  Automáticamente:             │
                    │  • Etapa desbloqueada         │
                    │  • Cliente puede acceder      │
                    │  • Cita → "completed"         │
                    │  • Toast: "¡Éxito!"           │
                    └──────────────────────────────┘
                                   │
═══════════════════════════════════════════════════════════════════════
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Usuario)                             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 10. Ve etapa desbloqueada
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  ✅ Etapa Desbloqueada        │
                    │                               │
                    │  Puede:                       │
                    │  • Ver contenido              │
                    │  • Descargar entregables      │
                    │  • Subir documentos           │
                    │  • Continuar proceso          │
                    └──────────────────────────────┘


═══════════════════════════════════════════════════════════════════════
                    📊 VISUALIZACIÓN DE PAGOS
═══════════════════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────────────────┐
│  /admin/manual-payments (Gestión de Pagos)                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📊 Resumen                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │Total Pagos  │  │Monto Total  │  │Este Mes     │                │
│  │     25      │  │  $125,000   │  │     8       │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
│                                                                      │
│  🔍 Buscar: [_________________]                                     │
│                                                                      │
│  📋 Tabla de Pagos                                                  │
│  ┌────────┬────────┬────────┬────────┬──────────┬──────────┬────┐ │
│  │ Fecha  │ Etapa  │ Monto  │ Método │Referencia│Registrado│ 👁️  │ │
│  ├────────┼────────┼────────┼────────┼──────────┼──────────┼────┤ │
│  │15 Nov  │Etapa 2 │$12,500 │Transfer│REF-12345 │Admin Uno │ 👁️  │ │
│  │14 Nov  │Etapa 1 │$3,000  │Zelle   │ZEL-9876  │Admin Dos │ 👁️  │ │
│  │...     │...     │...     │...     │...       │...       │... │ │
│  └────────┴────────┴────────┴────────┴──────────┴──────────┴────┘ │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  /admin/visa-cases/:id (Detalle del Caso) - Tab "Pagos"            │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Tabs: [Etapa 1] [Etapa 2] [Etapa 3] [📅 Citas] [💵 Pagos]         │
│                                                                      │
│  💰 Pagos Registrados para este caso                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ✅ Etapa 1                                $3,000            │    │
│  │ Método: Zelle                                                │    │
│  │ Fecha: 14 de noviembre 2025                                  │    │
│  │ Ref: ZEL-9876                                                │    │
│  │ Registrado por: Admin Uno                                    │    │
│  │ 📄 Ver Comprobante                                           │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Total Pagado: $3,000                                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Registrar Nuevo Pago] ← Botón verde                              │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Respuesta Rápida a tu Pregunta

**"¿Dónde agrego el pago del usuario?"**

**Respuesta**: En `/admin/manual-payments` → Click en botón verde "Registrar Pago"

O también desde el detalle del caso específico en el tab "Pagos"

---

## 📞 URLs Importantes

| Descripción | URL |
|-------------|-----|
| 🎯 **Registrar Pago** | `http://localhost:3000/admin/manual-payments` |
| 📅 Gestionar Citas | `http://localhost:3000/admin/appointments` |
| 📋 Ver Casos | `http://localhost:3000/admin/visa-cases` |
| 🔐 Login Admin | `http://localhost:3000/admin/auth` |

**Credenciales Admin**: `admin@urpe.com` / `urpe2024`
