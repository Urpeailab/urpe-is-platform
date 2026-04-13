# Módulo de Formularios USCIS — Documentación Técnica Completa

> **Última actualización**: 25 de febrero de 2026  
> **Archivos principales**: 9,174 líneas de código en 8 archivos  
> **Estado**: Producción activa

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Flujo Completo E2E](#2-flujo-completo-e2e)
3. [Backend — Endpoints](#3-backend--endpoints)
4. [Backend — Mapeo N8N del I-140](#4-backend--mapeo-n8n-del-i-140)
5. [Backend — Generación de PDF](#5-backend--generación-de-pdf)
6. [Frontend — Panel de Admin](#6-frontend--panel-de-admin)
7. [Frontend — Formulario Público del Cliente](#7-frontend--formulario-público-del-cliente)
8. [Estructura de Datos (MongoDB)](#8-estructura-de-datos-mongodb)
9. [Funciones de Normalización](#9-funciones-de-normalización)
10. [Traducción Español → Inglés](#10-traducción-español--inglés)
11. [Fixes y Bugs Conocidos](#11-fixes-y-bugs-conocidos)
12. [Guía de Debugging](#12-guía-de-debugging)

---

## 1. Arquitectura General

```
┌──────────────────────────────────────────────────────────────┐
│                    PANEL DE ADMIN (React)                     │
│  USCISFormsDashboard.js → USCISFormsFill.js → USCISFormsNew.js│
└──────────┬───────────────────────┬───────────────────────────┘
           │                       │
           │ API calls             │ Shared link
           ▼                       ▼
┌──────────────────┐    ┌─────────────────────────────────────┐
│  Backend FastAPI  │    │     FORMULARIO PÚBLICO (React)      │
│  routes/          │    │  PublicFormRouter → PreValidationForm│
│  uscis_forms.py   │    │  → PreValidationFormContent.js      │
│  (2,858 líneas)   │    │  → PublicFormFill.js                │
└──────────┬───────┘    └──────────┬──────────────────────────┘
           │                       │
           │                       │ POST /public/form/{token}/submit
           ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    MongoDB Collections                        │
│  uscis_templates | uscis_shared_forms | uscis_submissions     │
│  uscis_form_history | uscis_form_drafts                       │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│              i140_n8n_pdf_mapping.py (1,346 líneas)          │
│  fill_i140_form_n8n() → 200+ campos mapeados al PDF         │
│  format_date() | normalize_country() | normalize_state()      │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│              PDF Oficial I-140 de USCIS (PyMuPDF/fitz)       │
│              525 KB, almacenado en GridFS (uscis_forms.files) │
└──────────────────────────────────────────────────────────────┘
```

### Archivos del módulo

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `backend/routes/uscis_forms.py` | 2,858 | Todos los endpoints del módulo |
| `backend/data/i140_n8n_pdf_mapping.py` | 1,346 | Mapeo de campos del I-140 al PDF |
| `frontend/src/admin/pages/USCISFormsDashboard.js` | 1,041 | Dashboard admin con tabs |
| `frontend/src/admin/pages/USCISFormsFill.js` | 1,767 | Formulario de llenado del admin |
| `frontend/src/admin/pages/USCISFormsNew.js` | 401 | Crear nueva plantilla |
| `frontend/src/public/PreValidationFormContent.js` | 1,243 | Cuestionario corto del cliente |
| `frontend/src/public/PreValidationForm.js` | 389 | Wrapper del formulario público |
| `frontend/src/public/PublicFormFill.js` | 459 | Formulario completo público |
| `frontend/src/public/PublicFormRouter.js` | 71 | Router de formularios públicos |
| `frontend/src/admin/components/ChatAssistant.js` | 287 | Asistente IA para llenar formularios |
| `frontend/src/admin/components/FormSummaryModal.js` | 315 | Modal resumen del formulario |

---

## 2. Flujo Completo E2E

### Flujo Pre-Validación (el que se usa en producción)

```
COORDINADOR                    CLIENTE                     SISTEMA
     │                           │                            │
     │ 1. Crea "Compartir        │                            │
     │    con Cliente"            │                            │
     │───────────────────────────────────────────────────────►│
     │                           │     POST /shared-forms     │
     │                           │                            │
     │ 2. Recibe link            │                            │
     │◄──────────────────────────────────────────────────────│
     │                           │                            │
     │ 3. Envía link por         │                            │
     │    WhatsApp               │                            │
     │──────────────────────────►│                            │
     │                           │                            │
     │                           │ 4. Abre link               │
     │                           │─────────────────────────►│
     │                           │  GET /public/form/{token}  │
     │                           │                            │
     │                           │ 5. Llena 6 preguntas       │
     │                           │    (PreValidationForm)     │
     │                           │                            │
     │                           │ 6. Envía respuestas        │
     │                           │─────────────────────────►│
     │                           │  POST /public/form/submit  │
     │                           │                            │
     │ 7. Ve en "Envíos de       │                            │
     │    Clientes" las          │                            │
     │    respuestas             │                            │
     │◄──────────────────────────────────────────────────────│
     │  GET /client-submissions  │                            │
     │                           │                            │
     │ 8. Abre I-140 con         │                            │
     │    "Completar Formulario" │                            │
     │    (auto pre-llena)       │                            │
     │───────────────────────────────────────────────────────►│
     │  GET /client-submissions/{id}                          │
     │                           │                            │
     │ 9. Completa campos        │                            │
     │    restantes              │                            │
     │                           │                            │
     │ 10. "Generar y Descargar" │                            │
     │───────────────────────────────────────────────────────►│
     │  POST /fill               │                            │
     │     → fill_i140_form_n8n()│                            │
     │     → fill_pdf_fields()   │                            │
     │◄──────────────────────────────────────────────────────│
     │  ← PDF 525KB descargado   │                            │
```

### Las 6 preguntas del cliente (PreValidationFormContent.js)

El formulario del cliente captura esta información mínima:

1. **Tipo de procesamiento**: ¿Consular o Ajuste de Estatus en EE.UU.?
2. **Datos personales**: Nombre, apellido, segundo nombre
3. **Nacimiento**: Fecha, ciudad, estado/provincia, país
4. **Nacionalidad**: País de ciudadanía
5. **Identificación**: A-Number (si tiene), SSN (si tiene), USCIS Account
6. **Contacto**: Email, teléfono
7. **Si consular**: Ciudad y país del consulado
8. **Si en EE.UU.**: Dirección actual (calle, ciudad, provincia, país)

Estas respuestas se envían con `question` labels que coinciden EXACTAMENTE con las claves del `get_field_mapping()` en `i140_n8n_pdf_mapping.py`.

---

## 3. Backend — Endpoints

### Templates (Plantillas)

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `POST` | `/templates` | Crear nueva plantilla (con PDF opcional) |
| `GET` | `/templates` | Listar todas las plantillas |
| `GET` | `/templates/{id}` | Obtener detalle de plantilla |
| `GET` | `/templates/{id}/pdf` | Descargar PDF original de la plantilla |
| `DELETE` | `/templates/{id}` | Eliminar plantilla |
| `POST` | `/templates/{id}/regenerate-questions` | Regenerar preguntas con IA |
| `DELETE` | `/templates/{id}/questions` | Eliminar una pregunta |

### Llenado y Generación de PDF

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `POST` | `/fill` | **PRINCIPAL**: Llenar PDF con respuestas y descargarlo |
| `POST` | `/translate-answers` | Traducir respuestas de español a inglés |

### Historial

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `GET` | `/history` | Listar historial de formularios generados |
| `GET` | `/history/{id}` | Detalle de un historial |
| `GET` | `/history/{id}/download` | Descargar PDF de historial |
| `DELETE` | `/history/{id}` | Eliminar entrada de historial |

### Formularios Compartidos (Shared Forms)

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `POST` | `/shared-forms` | Crear link compartido para cliente |
| `GET` | `/shared-forms` | Listar links compartidos |
| `DELETE` | `/shared-forms/{token}` | Eliminar link compartido |

### Endpoints Públicos (Sin autenticación)

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `GET` | `/public/form/{token}` | Cliente accede al formulario |
| `POST` | `/public/form/{token}/submit` | Cliente envía respuestas |

### Envíos de Clientes (Client Submissions)

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `GET` | `/client-submissions` | Listar todos los envíos |
| `GET` | `/client-submissions/{id}` | Detalle de un envío |
| `PATCH` | `/client-submissions/{id}/status` | Cambiar estatus del envío |
| `PATCH` | `/client-submissions/{id}/save` | Guardar respuestas editadas |
| `GET` | `/client-submissions/{id}/download` | Descargar PDF del envío |
| `GET` | `/client-submissions/{id}/html-summary` | Resumen HTML del envío |

### Chat Asistente IA

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| `POST` | `/chat/start` | Iniciar conversación con IA para llenar formulario |
| `POST` | `/chat/message` | Enviar mensaje al asistente |

---

## 4. Backend — Mapeo N8N del I-140

### Archivo: `backend/data/i140_n8n_pdf_mapping.py`

Este archivo contiene la lógica completa para convertir las respuestas del formulario en campos del PDF oficial de USCIS.

### Función principal: `fill_i140_form_n8n(filled_form)`

**Input**: Diccionario `{question_label: answer_value}`  
**Output**: `{"fields": [{"fieldName": "form1[0].#subform[0]...", "text": "VALUE"}, ...]}`

### Orden de procesamiento:

1. **Direcciones hardcodeadas** (líneas 668-702):
   - Dirección del peticionario (empresa URPE): `3235 NORTH POINT PKWY, #101, ALPHARETTA, GA 30005`
   - Se aplica a Part 1 (subform[0]), Part 3 (subform[1]), Part 4 (subform[2])

2. **Checkboxes hardcodeados** (líneas 704-741):
   - NIW: `prt2PetitionType[6]` = "X"
   - Part 4 preguntas 6a, 8, 9, 10 = No
   - Part 5 1.b Self = "X"
   - Part 1 ítems 5 (No) y 6 (Yes)
   - Part 4 ítem 7 = No
   - Part 6 ítems 4, 6, 7 = Yes

3. **Tipo de procesamiento** (líneas 743-792):
   - Detecta "consular" vs "ajuste de estatus"
   - Llena checkboxes y campos de dirección según tipo

4. **Datos del beneficiario** (líneas 794-856):
   - Nombre, fecha de nacimiento, ciudad/estado/país de nacimiento
   - Se llena en Part 1 (peticionario = beneficiario para NIW) y Part 3

5. **Part 6 — Empleo** (líneas 858-916):
   - Job Title, SOC Code (split en 2 campos), descripción, horas, salario

6. **Part 7 — Familiares** (líneas 918-1064):
   - Hasta 6 personas con: apellido, nombre, DOB, país, relación
   - Checkboxes de Adjustment of Status y Visa Abroad por persona

7. **Campos dinámicos** (líneas 1090-1300):
   - Procesa el resto de campos no mapeados arriba
   - Maneja checkboxes NIW, tipo de petición, Sí/No
   - Normaliza países, fechas, A-Numbers, teléfonos, suites

### Diccionario de mapeo: `get_field_mapping()`

**200+ entradas** que mapean labels de preguntas a nombres de campos PDF:

```python
{
    # Ejemplo de mapeo directo
    "1.a. Apellido del Beneficiario": "form1[0].#subform[1].Pt3Line1a_FamilyName[0]",
    
    # Ejemplo de constante interna
    "PETITIONER_MAILING_STREET": "form1[0].#subform[0].Line6b_StreetNumberName[0]",
    
    # Ejemplo de checkbox Yes/No
    "PART6_FULLTIME_YES": "form1[0].#subform[3].Line4_Yes[0]",
    "PART6_FULLTIME_NO": "form1[0].#subform[3].Line4_No[0]",
    
    # Ejemplo de persona/familiar
    "Persona 1 - Apellido": "form1[0].#subform[3].Line1a_Person1FamilyName[0]",
}
```

### Estructura del PDF (subforms):

| Subform | Páginas | Contenido |
|---------|---------|-----------|
| `subform[0]` | Página 1 | Part 1 - Información del Peticionario |
| `subform[1]` | Página 2 | Part 2 (Tipo de Petición) + Part 3 (Beneficiario) |
| `subform[2]` | Página 3 | Part 4 (Procesamiento) + Part 5 (Info adicional) |
| `subform[3]` | Páginas 4-5 | Part 6 (Empleo) + Part 7 Personas 1-2 |
| `subform[4]` | Página 6 | Part 7 Personas 3-6 |
| `subform[5]` | Página 7 | Part 8 (Contacto y Firma) |

---

## 5. Backend — Generación de PDF

### Función: `fill_pdf_fields()` (uscis_forms.py, línea 840)

Usa **PyMuPDF (fitz)** para abrir el PDF y escribir en los widgets.

**Dos modos de operación**:

1. **Mapeo directo N8N** (`use_direct_mapping=True`):
   - Recibe lista de `{"fieldName": "...", "text": "..."}`
   - Busca cada widget por `field_name` exacto
   - Marca checkboxes con `field_value = True`

2. **Mapeo IA** (`use_direct_mapping=False`):
   - Usa formato `page{num}_{field_name}`
   - Matching por field_id normalizado

### Flujo del endpoint `/fill` (línea 1567):

```python
1. Verificar autenticación (admin/super_admin)
2. Buscar template por ID
3. Parsear answers_json
4. ¿Template tiene PDF? 
   → Sí: ¿Tiene pdf_field_mapping?
      → Sí: Usar fill_i140_form_n8n() (mapeo N8N directo)
      → No: Usar map_answers_to_fields() (mapeo IA con Gemini)
   → No: Generar HTML
5. fill_pdf_fields(pdf_bytes, field_mappings)
6. Guardar en historial
7. Retornar PDF como descarga
```

---

## 6. Frontend — Panel de Admin

### USCISFormsDashboard.js — 4 Tabs:

1. **Formularios**: Lista de plantillas (DS-160, I-140 N8N) con botones: Llenar, Chat, Compartir, Eliminar
2. **Historial**: PDFs generados anteriormente
3. **Enlaces Compartidos**: Links activos enviados a clientes
4. **Envíos de Clientes**: Respuestas recibidas de clientes (pre-validación)

### USCISFormsFill.js — Llenado del formulario:

**Modos de llenado**:
- **Manual**: El coordinador llena campo por campo
- **Asistente IA**: Chat interactivo que guía el llenado
- **Pre-llenado**: Carga respuestas de un envío de cliente

**Funcionalidades clave**:
- `fetchSubmissionAnswers()`: Carga respuestas del cliente y las mapea a los campos
- `mapSubmissionToAnswers()`: Mapea labels del cliente a IDs de preguntas del template
- `handleSubmit()`: Genera y descarga el PDF
- `handleTranslate()`: Traduce todas las respuestas al inglés antes de generar

**Progreso**: Se calcula como % de preguntas respondidas del total

---

## 7. Frontend — Formulario Público del Cliente

### Ruta: `/uscis-form/{token}`

### PublicFormRouter.js
Detecta el tipo de formulario y renderiza:
- `form_type === "pre_validation"` → `PreValidationForm`
- Otros → `PublicFormFill`

### PreValidationFormContent.js — El cuestionario de 6 preguntas

**Secciones del formulario**:
1. Tipo de procesamiento (consular vs ajuste)
2. Datos personales (nombre, DOB, lugar de nacimiento)
3. Nacionalidad e identificación (A-Number, SSN, USCIS Account)
4. Contacto (email, teléfono)
5. Dirección del consulado (si consular)
6. Dirección en EE.UU. (si ajuste)
7. Información de familiares (hasta 6 personas)

**Formato de envío**: Array de `{question, answer}` donde `question` es el label exacto que coincide con `get_field_mapping()`.

**Ejemplo de respuesta enviada**:
```json
[
  {"question": "1.a. Apellido del Beneficiario", "answer": "GONZALEZ"},
  {"question": "1.b. Nombre del Beneficiario", "answer": "KAREN"},
  {"question": "3. Fecha de Nacimiento", "answer": "15/03/1989"},
  {"question": "6. País de Nacimiento", "answer": "VENEZUELA"},
  {"question": "¿Dónde procesará la visa el beneficiario?", "answer": "2.a. Está en EE.UU. y solicitará ajuste de estatus"}
]
```

---

## 8. Estructura de Datos (MongoDB)

### Colección: `uscis_templates`

```javascript
{
  _id: "317b5608-...",           // UUID string
  name: "I-140 Formulario N8N",
  form_code: "I-140",
  visa_category: "EB",
  visa_subcategory: "EB-2 NIW",
  questions: {
    sections: [
      {
        name: "Part 1 - Information About the Petitioner",
        description: "...",
        questions: [
          {
            id: "q_1", 
            question: "1.a. Apellido (si es individuo)",
            type: "text",       // text | select | date | textarea
            required: true,
            hint: "..."
          }
        ]
      }
    ]
  },
  form_pdf_bytes: Binary(...),    // PDF del formulario oficial
  pdf_field_mapping: {...},       // Mapeo N8N (si existe)
  created_at: ISODate(...)
}
```

**NOTA IMPORTANTE**: El frontend busca `template.questions.sections`, NO `template.sections`. Si se crea un template programáticamente, las secciones DEBEN estar dentro del wrapper `questions`.

### Colección: `uscis_shared_forms`

```javascript
{
  _id: "abc123-token",            // Este ES el token del link público
  template_id: "317b5608-...",
  template_name: "I-140 Formulario N8N",
  client_name: "KAREN GONZALEZ",
  client_email: "karen@...",
  form_type: "pre_validation",    // "pre_validation" | "complete"
  status: "pending",              // "pending" | "completed"
  created_by: "staff-uuid",
  created_at: ISODate(...),
  expires_at: ISODate(...),       // 30 días por defecto
  submission_id: "..."            // Se llena cuando el cliente envía
}
```

### Colección: `uscis_submissions`

```javascript
{
  _id: "submission-uuid",
  shared_form_token: "abc123-token",
  template_id: "317b5608-...",
  template_name: "I-140 Formulario N8N",
  form_code: "I-140",
  client_name: "KAREN GONZALEZ",
  client_email: "karen@...",
  form_type: "pre_validation",
  submission_status: "por_revisar",  // "por_revisar" | "revisado" | "completado"
  answers: [
    {question: "1.a. Apellido del Beneficiario", answer: "GONZALEZ"}
  ],
  original_answers: [...],          // Copia de seguridad
  filled_pdf_bytes: null,           // null para pre_validation
  submitted_at: ISODate(...)
}
```

### Colección: `uscis_form_history`

```javascript
{
  _id: "history-uuid",
  staff_id: "staff-uuid",
  client_name: "KAREN GONZALEZ",
  template_id: "317b5608-...",
  template_name: "I-140 Formulario N8N",
  form_code: "I-140",
  answers: [...],
  field_mappings: [...],
  filled_pdf_bytes: Binary(...),
  file_type: "pdf",
  created_at: ISODate(...)
}
```

### GridFS: `uscis_forms.files` + `uscis_forms.chunks`

Almacena los PDFs originales de USCIS (blank forms).
- `i140_*.pdf` — 525 KB, formulario I-140 oficial

---

## 9. Funciones de Normalización

### `format_date(date_string)` — CORREGIDA
```
Input: "19/02/2026" (DD/MM/YYYY) → Output: "02/19/2026" (MM/DD/YYYY)
Input: "02/19/2026" (MM/DD/YYYY) → Output: "02/19/2026" (sin cambio)
Input: "1989-03-15" (ISO)         → Output: "03/15/1989"
Input: ""                         → Output: ""
```
**Fix aplicado**: Si el primer número es > 12, asume DD/MM/YYYY y hace swap.

### `normalize_country(country)`
```
"venezuela" → "VENEZUELA"
"colombia"  → "COLOMBIA"
"eeuu"      → "THE UNITED STATES OF AMERICA"
"estados unidos" → "THE UNITED STATES OF AMERICA"
```

### `normalize_state(state)`
```
"florida"   → "FL"
"texas"     → "TX"
"california" → "CA"
"georgia"   → "GA"
```

### `normalize_relationship(relationship)`
```
"esposa"    → "Spouse"
"hijo"      → "Child"
"hija"      → "Child"
```

### `normalize_yes_no(value)`
```
"sí"        → "Yes"
"si"        → "Yes"
"no"        → "No"
```

### `clean_phone_number(phone)` — Remueve todo excepto dígitos
### `clean_a_number(a_number)` — Remueve prefijo "A-"

---

## 10. Traducción Español → Inglés

### Función: `translate_spanish_to_english(text, field_context)`

**Ubicación**: `routes/uscis_forms.py`, línea 67

**Flujo**:
1. Revisa cache en memoria (evita llamadas duplicadas)
2. Revisa traducciones hardcodeadas comunes (relaciones, países, sí/no)
3. Detecta si el texto ya está en inglés (skip)
4. Detecta si son solo números/fechas (skip)
5. Si nada anterior aplica → llama a OpenAI GPT para traducir

**Se usa cuando**: El coordinador hace clic en "Traducir a Inglés" antes de generar el PDF.

**Endpoint**: `POST /translate-answers`
- Recibe: `{answers: [{question, answer}], template_id}`
- Retorna: Respuestas traducidas al inglés

---

## 11. Fixes y Bugs Conocidos

### Fix 1: `format_date` — Fechas DD/MM/YYYY (Feb 2026)
- **Bug**: Fecha `19/02/2026` se pasaba directo al PDF como mes 19 (inválido)
- **Causa**: La regex `^\d{2}/\d{2}/\d{4}$` matcheaba sin verificar rango
- **Fix**: Si `part1 > 12`, asume DD/MM/YYYY y hace swap a MM/DD/YYYY
- **Archivo**: `backend/data/i140_n8n_pdf_mapping.py`, función `format_date`
- **Estado**: Corregido en develop, pendiente deploy a producción

### Fix 2: Mejor manejo de errores en `/fill` (Feb 2026)
- **Bug**: Errores en mapeo N8N o llenado PDF retornaban HTTP 500 genérico
- **Fix**: Try/catch específicos con mensajes descriptivos
- **Archivo**: `backend/routes/uscis_forms.py`, líneas 1608-1621
- **Estado**: Corregido en develop, pendiente deploy

### Bug conocido: Producción devuelve HTTP 500 al generar PDF
- **Síntoma**: Coordinadora completa formulario I-140, hace clic en "Generar y Descargar", error
- **Causa probable**: Fix de `format_date` no deployado
- **Reproducción**: `POST /fill` con fecha en formato DD/MM/YYYY donde día > 12

### Nota: Template debe usar `questions.sections` no `sections`
- **Contexto**: Si se crea un template programáticamente (no por UI), las secciones deben estar dentro de `{questions: {sections: [...]}}`
- **El frontend busca**: `template.questions.sections[].questions[]`
- **Si se pone en**: `template.sections[]` → el formulario aparece vacío

---

## 12. Guía de Debugging

### El formulario aparece vacío (sin preguntas)
1. Verificar que el template tiene `questions.sections` (no `sections` suelto)
2. `db.uscis_templates.find_one({form_code: "I-140"}, {form_pdf_bytes: 0})` → revisar estructura

### Error al generar PDF
1. Revisar logs: `tail -50 /var/log/supervisor/backend.err.log | grep -i "error\|fail\|N8N\|PDF"`
2. Verificar que el template tiene `form_pdf_bytes` (no null)
3. Verificar que el template tiene `pdf_field_mapping` (para usar N8N, sino usa IA)
4. Probar mapeo aislado:
```python
from data.i140_n8n_pdf_mapping import fill_i140_form_n8n
result = fill_i140_form_n8n({"1.a. Apellido del Beneficiario": "TEST"})
print(f"Fields: {len(result['fields'])}")
```

### El cliente llena el formulario pero no aparece en "Envíos de Clientes"
1. Verificar que el shared_form tiene `status: "completed"` y `submission_id`
2. Verificar que existe el documento en `uscis_submissions` con ese `submission_id`
3. El dashboard no hace polling automático — requiere recarga de página (pendiente de implementar)

### Las respuestas del cliente no se pre-llenan en el formulario del admin
1. Verificar que `submission.answers[].question` coincide con `template.questions.sections[].questions[].question`
2. El mapeo se hace por texto exacto del label (case-sensitive en algunos casos)
3. Revisar consola del navegador: `[DEBUG] Fetching submission answers for ID: ...`

### Comparar template de producción vs develop
```bash
# Desde el pod de develop
PROD_URL="https://panel.urpeintegralservices.co"
PROD_TOKEN=$(curl -s -X POST "$PROD_URL/api/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@urpe.com","password":"urpe2024"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s "$PROD_URL/api/uscis-forms/templates/317b5608-9729-4740-9553-dd021b09b494" \
  -H "Authorization: Bearer $PROD_TOKEN" | python3 -m json.tool > /tmp/prod_template.json
```

---

## Templates en la Base de Datos

### Producción (panel.urpeintegralservices.co)
| Template | Code | Creado | Notas |
|----------|------|--------|-------|
| DS-160 | DS-160 | 14 ene 2026 | Visa de turista |
| I-140 Formulario N8N | I-140 | 21 ene 2026 | **Template principal para EB-2 NIW** |

### Develop (visa-case-app.preview.emergentagent.com)
| Template | Code | Creado | Notas |
|----------|------|--------|-------|
| DS-160 | DS-160 | 14 ene 2026 | Visa de turista |
| i140 | i140 | 21 ene 2026 | Template viejo para pruebas de autocreación (NO TOCAR) |
| I-140 Formulario N8N | I-140 | 23 feb 2026 | Copia de producción + PDF + mapping N8N |

---

*Documentación generada el 25 de febrero de 2026*
