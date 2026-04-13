# Documentación del Módulo de Formularios USCIS

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Flujo de Pre-validación I-140](#flujo-de-pre-validación-i-140)
4. [Mapeo de Campos I-140](#mapeo-de-campos-i-140)
5. [Endpoints de API](#endpoints-de-api)
6. [Componentes Frontend](#componentes-frontend)
7. [Base de Datos](#base-de-datos)

---

## Visión General

El módulo de formularios USCIS permite a los administradores/coordinadores:
- Crear plantillas de formularios USCIS
- Compartir formularios con clientes via links seguros
- Recopilar información del cliente mediante formularios de pre-validación
- Completar el formulario completo con datos pre-llenados
- Generar PDFs rellenados

### Tipos de Formularios Soportados
- **I-140**: Immigrant Petition for Alien Workers
- **I-907**: Request for Premium Processing Service
- **DS-160**: Online Nonimmigrant Visa Application (sin PDF, genera HTML)

---

## Arquitectura

```
/app/
├── backend/
│   └── routes/
│       └── uscis_forms.py          # Toda la lógica del módulo
│
└── frontend/
    └── src/
        ├── admin/
        │   ├── components/
        │   │   └── ChatAssistant.js    # Asistente AI "Mónica"
        │   └── pages/
        │       ├── USCISFormsDashboard.js  # Dashboard principal
        │       └── USCISFormsFill.js       # Llenar formularios
        │
        └── public/
            ├── PreValidationFormContent.js  # Formulario corto (6 preguntas)
            ├── PublicFormFill.js            # Formulario completo público
            └── PublicFormRouter.js          # Router inteligente
```

---

## Flujo de Pre-validación I-140

### Propósito
Recopilar **solo 6 datos básicos** del cliente ANTES de que el operador complete el formulario completo. Esto permite:
1. Validar información básica del cliente
2. Pre-llenar campos específicos en el formulario I-140 completo
3. Reducir errores de entrada de datos

### Las 6 Preguntas del Cuestionario

| # | Pregunta | Destino en I-140 | Sección/Item |
|---|----------|------------------|--------------|
| 1 | Número de cuenta USCIS | Part 3 (Beneficiario) - USCIS Online Account | Item 10 |
| 2 | Número de Seguro Social (SSN) | Part 3 (Beneficiario) - U.S. SSN | Item 9 |
| 3 | Dirección - Calle y Número | Part 4 (Processing Information) - Foreign Address | Item 3.a |
| 4 | Dirección - Apartamento/Suite | Part 4 (Processing Information) - Foreign Address | Item 3.b |
| 5 | Dirección - Ciudad | Part 4 (Processing Information) - Foreign Address | Item 3.c |
| 6 | Dirección - Provincia/Estado | Part 4 (Processing Information) - Foreign Address | Item 3.d |
| 7 | Dirección - Código Postal | Part 4 (Processing Information) - Foreign Address | Item 3.e |
| 8 | Dirección - País | Part 4 (Processing Information) - Foreign Address | Item 3.f |
| 9 | Código A (A-Number) | Part 3 (Beneficiario) - Alien Registration Number | Item 8 |
| 10 | Correo Electrónico | Part 8 (Contact Info) - Email | Item 5 |
| 11 | Número de Teléfono | Part 8 (Contact Info) - Daytime Phone | Item 3 |

### Flujo del Usuario

```
1. Admin genera link de pre-validación
   ↓
2. Cliente recibe link y abre formulario público
   ↓
3. Cliente llena las 6 preguntas + dirección
   ↓
4. Sistema guarda submission con status "por_revisar"
   ↓
5. Admin ve submission en dashboard
   ↓
6. Admin hace clic en "Completar"
   ↓
7. Sistema carga formulario I-140 con datos pre-llenados
   ↓
8. Admin completa campos restantes
   ↓
9. Sistema genera PDF rellenado
```

---

## Mapeo de Campos I-140

### IMPORTANTE: Estructura del PDF I-140

El formulario I-140 tiene varias secciones de direcciones que NO deben confundirse:

#### ❌ NO USAR para datos del cliente:
- **Part 1, Mailing Address (Items 3.a-3.i)**: Dirección de CORRESPONDENCIA de la EMPRESA/PETICIONARIO
- **Part 3, Section 2, Mailing Address (Items 2.a-2.i)**: Dirección de CORRESPONDENCIA del BENEFICIARIO (en USA)
- **Part 5, Items 5.a-5.g**: Otra dirección de la empresa

#### ✅ USAR para datos del cliente (beneficiario extranjero):
- **Part 4 - Processing Information (continued), Items 3.a-3.f**: 
  - "If you provided a United States address in Part 3., provide the person's foreign address"
  - Esta es la **DIRECCIÓN EN EL EXTRANJERO** del cliente/beneficiario

### Tabla de Mapeo Completa

```javascript
// Mapeo de preguntas pre-validación → campos I-140
const PRE_VALIDATION_TO_I140_MAPPING = {
  // === PARTE 3 - INFORMACIÓN DEL BENEFICIARIO ===
  'Número de cuenta USCIS': {
    pdfField: 'Part3_Item10_USCISOnlineAccount',
    section: 'Parte 3: Información del Beneficiario',
    item: '10. USCIS Online Account Number',
    questionIdPatterns: ['uscis_online', 'beneficiary_uscis']
  },
  
  'Número de Seguro Social': {
    pdfField: 'Part3_Item9_SSN',
    section: 'Parte 3: Información del Beneficiario', 
    item: '9. U.S. Social Security Number',
    questionIdPatterns: ['beneficiary_ssn', '_ssn']
  },
  
  'Código A (Alien Registration Number)': {
    pdfField: 'Part3_Item8_AlienNumber',
    section: 'Parte 3: Información del Beneficiario',
    item: '8. Alien Registration Number (A-Number)',
    questionIdPatterns: ['alien_number', 'a_number']
  },
  
  // === PARTE 4 - PROCESSING INFORMATION (FOREIGN ADDRESS) ===
  'Dirección - Calle y Número': {
    pdfField: 'Part4_Item3a_StreetNumber',
    section: 'Part 4: Processing Information (continued)',
    item: '3.a. Street Number and Name',
    questionIdPatterns: ['foreign_address_street', 'part4_street']
  },
  
  'Dirección - Apartamento/Suite': {
    pdfField: 'Part4_Item3b_AptSteFl',
    section: 'Part 4: Processing Information (continued)',
    item: '3.b. Apt. / Ste. / Flr.',
    questionIdPatterns: ['foreign_address_apt', 'part4_apt']
  },
  
  'Dirección - Ciudad': {
    pdfField: 'Part4_Item3c_CityTown',
    section: 'Part 4: Processing Information (continued)',
    item: '3.c. City or Town',
    questionIdPatterns: ['foreign_address_city', 'part4_city']
  },
  
  'Dirección - Estado': {
    pdfField: 'Part4_Item3d_Province',
    section: 'Part 4: Processing Information (continued)',
    item: '3.d. Province',
    questionIdPatterns: ['foreign_address_province', 'part4_province', 'foreign_state']
  },
  
  'Dirección - Código Postal': {
    pdfField: 'Part4_Item3e_PostalCode',
    section: 'Part 4: Processing Information (continued)',
    item: '3.e. Postal Code',
    questionIdPatterns: ['foreign_address_postal', 'part4_postal']
  },
  
  'Dirección - País': {
    pdfField: 'Part4_Item3f_Country',
    section: 'Part 4: Processing Information (continued)',
    item: '3.f. Country',
    questionIdPatterns: ['foreign_address_country', 'part4_country']
  },
  
  // === PARTE 8 - INFORMACIÓN DE CONTACTO ===
  'Correo Electrónico': {
    pdfField: 'Part8_Item5_Email',
    section: 'Part 8: Contact Information',
    item: '5. E-mail Address',
    questionIdPatterns: ['contact_email', 'email']
  },
  
  'Número de Teléfono': {
    pdfField: 'Part8_Item3_DaytimePhone',
    section: 'Part 8: Contact Information',
    item: '3. Daytime Phone Number',
    questionIdPatterns: ['contact_phone', 'daytime_phone', 'phone']
  }
};
```

---

## Endpoints de API

### Formularios Compartidos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/uscis-forms/shared-forms` | Crear link compartido |
| GET | `/api/uscis-forms/public/form/{token}` | Obtener formulario público |
| POST | `/api/uscis-forms/public/form/{token}/submit` | Enviar formulario |

### Submissions

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/uscis-forms/client-submissions` | Listar submissions |
| GET | `/api/uscis-forms/client-submissions/{id}` | Detalles con respuestas |
| GET | `/api/uscis-forms/client-submissions/{id}/download` | Descargar PDF |

### Templates

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/uscis-forms/templates` | Listar templates |
| GET | `/api/uscis-forms/templates/{id}` | Obtener template |
| POST | `/api/uscis-forms/templates/{id}/regenerate-questions` | Regenerar preguntas |

---

## Componentes Frontend

### PreValidationFormContent.js
- Formulario corto de 6 preguntas
- Incluye `SearchableSelect` para País/Estado/Ciudad
- Datos de países latinoamericanos en `LATAM_DATA`
- Validación de campos obligatorios

### USCISFormsFill.js
- Formulario completo para operadores
- Función `mapSubmissionToAnswers()` para pre-llenar
- Modo manual vs AI Chat (Mónica)

---

## Base de Datos

### Colección: `uscis_shared_forms`
```javascript
{
  "_id": "uuid-token",
  "template_id": "template-uuid",
  "client_name": "Nombre Cliente",
  "client_email": "email@example.com",
  "form_type": "pre_validation" | "complete",
  "status": "pending" | "completed",
  "created_by": "staff-id",
  "expires_at": ISODate,
  "submission_id": "submission-uuid" // después de submit
}
```

### Colección: `uscis_submissions`
```javascript
{
  "_id": "submission-uuid",
  "shared_form_token": "uuid-token",
  "template_id": "template-uuid",
  "client_name": "Nombre",
  "client_email": "email",
  "answers": [
    { "question": "Pregunta", "answer": "Respuesta" }
  ],
  "submission_status": "por_revisar" | "completado",
  "form_type": "pre_validation" | "complete",
  "submitted_at": ISODate
}
```

---

## Notas para Desarrolladores

### Al modificar el mapeo:
1. Consultar este documento primero
2. Verificar la sección correcta del PDF I-140
3. Actualizar tanto frontend (`mapSubmissionToAnswers`) como este documento

### Campos de la EMPRESA (NO tocar con datos del cliente):
- Part 1: Mailing Address (3.a-3.i)
- Part 3 Section 2: Mailing Address (2.a-2.i)  
- Part 5: Mailing Address (5.a-5.g)

### Campos del CLIENTE/BENEFICIARIO:
- Part 3: Información personal del beneficiario
- Part 4: Foreign Address (dirección en el extranjero)
- Part 8: Información de contacto

---

*Última actualización: Enero 2026*
