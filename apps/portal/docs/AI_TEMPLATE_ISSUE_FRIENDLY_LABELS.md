# 🐛 Problema Pendiente: Friendly Labels en Generación AI de Formularios

## Fecha de Identificación
21 de enero de 2026

---

## 📋 Resumen del Problema

Las preguntas generadas por el sistema AI muestran **IDs técnicos** de los campos del PDF en lugar de texto legible en español.

### Ejemplo del Problema:

**❌ Incorrecto (Estado Actual):**
```
¿Cuál es su form1[0].#subform[0].Pt1Line1a_FamilyName[0]?
¿Cuál es su form1[0].#subform[0].Pt1Line1b_GivenName[0]?
¿Cuál es su form1[0].#subform[0].Pt1Line1c_MiddleName[0]?
```

**✅ Correcto (Estado Deseado):**
```
¿Cuál es su apellido familiar?
¿Cuál es su nombre de pila?
¿Cuál es su segundo nombre?
```

---

## 🔍 Causa Raíz Identificada

### 1. **Incompatibilidad Pydantic + google.generativeai**
El SDK `google.generativeai` (deprecado) tiene problemas con modelos Pydantic que usan:
- `default=None` en campos Optional
- `default_factory=list` 
- `Dict` sin estructura definida

**Error específico:**
```
Unknown field for Schema: default
```

### 2. **Proceso de Generación de Labels Falla Silenciosamente**
```python
# En FormProcessorGemini.generate_friendly_labels()
response = self.model.generate_content(
    prompt,
    generation_config=genai.GenerationConfig(
        response_schema=FieldLabelsResponse,  # ❌ Falla aquí
        ...
    )
)
```

Cuando falla, el método cae al **fallback**:
```python
except Exception as e:
    logger.error(f"[Gemini] Error en labels: {e}")
    # Fallback: usar nombres nativos
    for f in fields:
        f['friendly_label'] = f.get('native_field_name', f['field_id'])  # ❌ Usa field_id
    return fields
```

### 3. **El Fallback Usa field_id Directamente**
En `_generate_basic_questions()`:
```python
label = f.get('friendly_label') or f.get('native_field_name') or 'este campo'
# Si friendly_label no existe, usa native_field_name que es algo como "Pt1Line1a_FamilyName"
# Que aún es mejor que field_id, pero no es legible
```

---

## 📊 Estado Actual del Sistema

| Componente | Estado | Descripción |
|------------|--------|-------------|
| **Arquitectura** | ✅ Correcta | Diseño modular y escalable |
| **Procesamiento Chunks** | ✅ Funcional | Maneja formularios grandes (262 campos) |
| **Detección Secciones** | ✅ Funcional | Identifica 15 secciones automáticamente |
| **Cobertura Campos** | ✅ 100% | Genera 262 preguntas para 262 campos |
| **Pydantic Schemas** | ⚠️ Problemático | Incompatibilidad con google.generativeai |
| **Friendly Label Gen** | ❌ Falla | Error "Unknown field for Schema: default" |
| **Fallback Básico** | ⚠️ Funciona | Genera preguntas pero con IDs técnicos |
| **Integración Backend** | ✅ Completa | Tupla (questionnaire, fields_with_labels) |

---

## 🛠️ Soluciones Propuestas

### **Opción A: Solución Rápida (Recomendada para MVP)**

**Descripción:** Mejorar el fallback para extraer nombres legibles sin usar Gemini.

**Implementación:**
```python
def extract_friendly_name_from_field(field_id: str, native_name: str) -> str:
    """
    Extrae nombre legible del native_field_name.
    
    Ejemplo:
    - "Pt1Line1a_FamilyName" → "Apellido Familiar"
    - "Pt1Line8_USCISOnlineActNumber" → "Número de Cuenta en Línea USCIS"
    """
    # Limpiar prefijos técnicos
    clean_name = re.sub(r'^(form\d+|Pt\d+Line\d+[a-z]?|Page\d+)_?', '', native_name)
    
    # Separar camelCase
    words = re.findall(r'[A-Z][a-z]*|[a-z]+', clean_name)
    
    # Traducción básica de términos comunes
    translations = {
        'Family': 'Apellido',
        'Name': 'Nombre',
        'Given': 'de Pila',
        'Middle': 'Segundo',
        'Tax': 'Impuesto',
        'Number': 'Número',
        'USCIS': 'USCIS',
        'Online': 'en Línea',
        'Act': 'de Cuenta',
        # ... más traducciones
    }
    
    translated = [translations.get(word, word) for word in words]
    return ' '.join(translated)
```

**Ventajas:**
- ✅ No depende de Gemini
- ✅ Implementación rápida (1-2 horas)
- ✅ Sin problemas de schemas Pydantic
- ✅ Funciona offline

**Desventajas:**
- ⚠️ Traducciones limitadas (solo términos comunes)
- ⚠️ Puede no ser perfecto para todos los casos

---

### **Opción B: Solución Completa (Correcta pero requiere más trabajo)**

**Descripción:** Arreglar completamente la compatibilidad con Pydantic.

**Cambios Necesarios:**

1. **Simplificar Schemas Pydantic:**
```python
# ❌ ACTUAL (Problemático)
class Question(BaseModel):
    id: str
    question: str
    type: str
    required: bool
    placeholder: Optional[str] = Field(description="...")  # ❌ Problema aquí
    hint: Optional[str] = Field(description="...")
    options: Optional[List[str]] = Field(description="...")
    field_ids: Optional[List[str]] = Field(description="...")

# ✅ PROPUESTO (Sin Optional con default)
class Question(BaseModel):
    id: str
    question: str
    type: str
    required: bool
    # Campos opcionales como strings vacíos
    placeholder: str = ""
    hint: str = ""
    # Listas siempre inicializadas
    options: List[str] = []
    field_ids: List[str] = []
```

2. **Migrar a `google.genai` (nuevo SDK):**
```python
# En lugar de:
import google.generativeai as genai

# Usar:
from google import genai
```

**Ventajas:**
- ✅ Solución permanente
- ✅ Traducciones contextuales perfectas con Gemini
- ✅ Escalable para el futuro

**Desventajas:**
- ⚠️ Requiere más tiempo (4-6 horas)
- ⚠️ Testing exhaustivo necesario
- ⚠️ Posibles nuevos problemas con SDK nuevo

---

## 📁 Archivos Afectados

### Archivos Creados:
1. `/app/backend/utils/form_processor_gemini.py` (600+ líneas)
   - Clase `FormProcessorGemini`
   - Modelos Pydantic con problemas
   - Funciones de generación y mapeo

### Archivos Modificados:
2. `/app/backend/routes/uscis_forms.py`
   - Función `generate_questions_for_form()` - Devuelve tupla
   - Endpoint `/templates/create` - Guarda fields con labels
   - Endpoint `/templates/{id}/regenerate-questions` - Actualiza fields

---

## 🧪 Testing Realizado

### Test 1: Formulario I-140 (262 campos)
```
✅ Campos detectados: 262
✅ Secciones identificadas: 15
✅ Preguntas generadas: 262
✅ Cobertura: 100%
❌ Preguntas legibles: 0% (todas muestran field_id)
```

### Test 2: Logs de Errores
```bash
# Todos los chunks fallan con el mismo error:
[Gemini] Error en chunk page0: Unknown field for Schema: default
[Gemini] Error en chunk part1: Unknown field for Schema: default
[Gemini] Error en chunk page1: Unknown field for Schema: default
# ... (15 secciones, todas fallan)
```

---

## 📝 Próximos Pasos

### Cuando se retome esta tarea:

1. **Decisión:** Elegir entre Opción A (rápida) u Opción B (completa)

2. **Si Opción A:**
   - Implementar función `extract_friendly_name_from_field()`
   - Agregar diccionario de traducciones completo
   - Actualizar `_generate_basic_questions()` para usarla
   - Testing con formulario I-140

3. **Si Opción B:**
   - Eliminar TODOS los `Optional` con defaults
   - Convertir a tipos básicos (str, List[str])
   - Testing aislado de cada modelo Pydantic
   - Considerar migración a `google.genai`

---

## 🚨 Notas Importantes

- **NO afecta a plantilla N8N:** La plantilla N8N funciona perfectamente al 100% (113 preguntas legibles)
- **NO afecta a DS-160:** Esta plantilla también funciona correctamente
- **SOLO afecta:** Generación de nuevos formularios con AI (I-140 AI, futuros formularios)

---

## 🎯 Impacto en Producción

**Crítico para:**
- ❌ Nuevos formularios generados con AI
- ❌ Regeneración de cuestionarios existentes

**NO afecta:**
- ✅ Plantilla N8N (determinística)
- ✅ Plantilla DS-160
- ✅ Llenado de formularios existentes
- ✅ Mapeo de respuestas a PDF

---

## 📞 Contacto

Documentado por: E1 Agent  
Fecha: 21 de enero de 2026  
Estado: **PENDIENTE DE RESOLVER**

---

_Este documento será actualizado cuando se implemente la solución._
