# Análisis Comparativo: Cuestionario I-140

## Resumen

Este documento compara:
1. **PDF de ejemplo** (I-140 MALDONADO.pdf) - campos llenos
2. **Cuestionario JSON de N8N** - cuestionario de referencia
3. **Template actual** en la plataforma

---

## CAMPOS QUE FALTAN EN EL TEMPLATE ACTUAL

### ❌ PART 4 - Processing Information (CRÍTICO)

Estos campos están en el JSON de N8N pero **NO existen** en el template actual:

| Campo | Descripción | Importancia |
|-------|-------------|-------------|
| `3.a. Número y Nombre de la Calle` | Foreign Address - Calle (dirección en país de origen) | **CRÍTICO** |
| `3.b. Apartamento` | Foreign Address - Apt/Suite | **CRÍTICO** |
| `3.c. Ciudad` | Foreign Address - Ciudad | **CRÍTICO** |
| `3.d. Provincia` | Foreign Address - Provincia/Estado | **CRÍTICO** |
| `3.e. Código Postal` | Foreign Address - Postal Code | **CRÍTICO** |
| `3.f. País` | Foreign Address - Country | **CRÍTICO** |
| `1.a. Ciudad o Pueblo` | Ciudad donde procesará la visa consular | ALTO |
| `1.c. País` | País donde procesará la visa consular | ALTO |
| `2.b. País de residencia actual` | País de residencia del beneficiario | ALTO |

**Nota:** El template actual tiene `beneficiary_address_*` que corresponde a la dirección de correspondencia en USA (Mailing Address), NO a la Foreign Address del país de origen.

### ❌ PART 1 - Petitioner Info (Faltan algunos campos)

| Campo | Descripción | En Template? |
|-------|-------------|--------------|
| `1.a. Apellido (si es individuo)` | Apellido del peticionario individual | ✅ Existe como `petitioner_family_name` |
| `1.b. Nombre (si es individuo)` | Nombre del peticionario individual | ✅ Existe como `petitioner_given_name` |
| `1.c. Segundo Nombre (si es individuo)` | Middle name | ❌ **FALTA** |
| `7. SSN (si aplica)` | SSN del peticionario | ✅ Existe |
| `8. USCIS Online Account Number` | Cuenta USCIS del peticionario | ❌ **FALTA** (solo existe para beneficiario) |

### ❌ PART 2 - Petition Type

| Campo | Descripción | En Template? |
|-------|-------------|--------------|
| `Seleccione el tipo de petición (SOLO UNA OPCIÓN)` | NIW, EB-1A, EB-1B, etc. | ✅ Existe como `petition_classification` |
| Checkbox NIW específico | "1.h. Extranjero solicitando NIW..." | ❓ Verificar opciones |

### ❌ PART 3 - Beneficiary Info

| Campo | Descripción | En Template? |
|-------|-------------|--------------|
| `1.a-c. Nombre completo` | Apellido, nombre, segundo nombre | ✅ Existen |
| `3. Fecha de nacimiento` | DOB | ✅ Existe |
| `4. Ciudad de nacimiento` | Birth city | ✅ Existe |
| `5. Estado de nacimiento` | Birth state | ✅ Existe |
| `6. País de nacimiento` | Birth country | ✅ Existe |
| `7. País de ciudadanía` | Nationality | ✅ Existe |
| `8. A-Number` | Alien Registration | ✅ Existe |
| `9. SSN beneficiario` | Social Security | ✅ Existe |
| `10. Fecha última llegada` | Last arrival date | ✅ Existe como `last_entry_date` |
| `11.a. Número I-94` | I-94 number | ✅ Existe |
| `11.b. Fecha vencimiento I-94` | I-94 expiration | ✅ Existe como `status_expires` |
| `11.c. Estatus I-94` | Current status | ✅ Existe |
| `12. Número pasaporte` | Passport number | ✅ Existe |
| `13. Número documento viaje` | Travel doc number | ❌ **FALTA** |
| `14. País emisión pasaporte` | Passport country | ✅ Existe |
| `15. Fecha vencimiento pasaporte` | Passport expiration | ✅ Existe |

### ❌ PART 5 - Additional Petitioner Info

| Campo | Descripción | En Template? |
|-------|-------------|--------------|
| `Tipo de peticionario` | Employer/Self-petition/Other | ❌ **FALTA** (dropdown específico) |
| `11. Ocupación del peticionario individual` | Self-petitioner occupation | ❌ **FALTA** |
| `12. Ingreso anual del peticionario individual` | Self-petitioner annual income | ❌ **FALTA** |

### ❌ PART 6 - Proposed Employment

| Campo | Descripción | En Template? |
|-------|-------------|--------------|
| `1. Job Title` | Título del trabajo | ✅ Existe |
| `2. SOC Code` | Código SOC (2 partes) | ✅ Existe |
| `3. Job Description` | Descripción no técnica | ✅ Existe |
| `4. Is full-time?` | ¿Tiempo completo? Yes/No | ❌ **FALTA** (específico) |
| `5. Hours per week` | Horas por semana | ✅ Existe |
| `6. Is permanent?` | ¿Permanente? Yes/No | ✅ Similar existe |
| `7. Is new position?` | ¿Posición nueva? Yes/No | ❌ **FALTA** |
| `8. Wages` | Salario y período | ✅ Existe |
| `9.a-e. Worksite address` | Dirección de trabajo (5 campos) | ✅ Existe parcialmente |

### ❌ PART 7 - Family Information (CRÍTICO - 6 PERSONAS)

El template actual **NO TIENE** la sección de información familiar. El JSON de N8N incluye:

- Persona 1: Cónyuge o Hijo (7 campos)
- Persona 2: Cónyuge o Hijo (7 campos)
- Persona 3: Hijo (7 campos)
- Persona 4: Hijo (7 campos)
- Persona 5: Hijo (7 campos)
- Persona 6: Hijo (7 campos)

Para cada persona:
- Apellido
- Nombre  
- Segundo nombre
- Fecha de nacimiento
- País de nacimiento
- Relación (Cónyuge/Hijo)
- ¿Solicitará ajuste de estatus? (Yes/No)
- ¿Solicitará visa en el extranjero? (Yes/No)

**Total campos faltantes para Part 7:** ~48 campos

### ❌ PART 8 - Contact & Signature (PARCIALMENTE)

| Campo | Descripción | En Template? |
|-------|-------------|--------------|
| `1.a. Apellido del signatario` | Signer last name | ❌ **FALTA** (específico) |
| `1.b. Nombre del signatario` | Signer first name | ❌ **FALTA** (específico) |
| `2. Título del signatario` | Signer title | ❌ **FALTA** |
| `3. Teléfono de día` | Daytime phone | ✅ Existe como `petitioner_daytime_phone` |
| `4. Teléfono móvil` | Mobile phone | ✅ Existe como `petitioner_mobile_phone` |
| `5. Dirección de email` | Email | ✅ Existe |
| `Certificación` | Checkbox de certificación | ❌ **FALTA** |
| `6.b. Fecha de firma` | Signature date | ✅ Existe |

---

## RESUMEN DE CAMPOS FALTANTES

### Críticos (Bloquean uso del formulario):
1. **Foreign Address (Part 4, Items 3.a-3.f)** - 6 campos
2. **Family Information (Part 7)** - ~48 campos (6 personas × 8 campos)
3. **Processing Information adicional (Part 4)** - 3 campos

### Importantes (Mejoran completitud):
1. Segundo nombre del peticionario (Part 1)
2. USCIS Online Account del peticionario (Part 1)
3. Número de documento de viaje (Part 3)
4. Tipo de peticionario específico (Part 5)
5. Ocupación e ingreso del auto-peticionario (Part 5)
6. Campos específicos de Part 6 (is_new_position, is_full_time como Yes/No)
7. Campos del signatario (Part 8)

### Total estimado de campos faltantes: ~70 campos

---

## RECOMENDACIÓN

Crear un nuevo JSON de preguntas para el template I-140 que incluya TODOS los campos del JSON de N8N, organizados por partes del formulario oficial USCIS I-140.

Prioridad:
1. **ALTA**: Part 4 Foreign Address (Items 3.a-3.f)
2. **ALTA**: Part 7 Family Information (Personas 1-6)
3. **MEDIA**: Part 5 campos de auto-peticionario
4. **MEDIA**: Part 8 campos del signatario
5. **BAJA**: Campos adicionales menores

---

*Documento generado: Enero 2026*
