# Plan de Refactorización de server.py

## Estado Actual (03/03/2026)
- **Tamaño:** ~38,250 líneas (reducido de ~38,900)
- **Líneas eliminadas:** ~650 (endpoints de clientes migrados)
- **Funciones:** ~340+ funciones async/def
- **Endpoints:** ~140+ endpoints de API

## Estructura Propuesta

```
/app/backend/
├── server.py              # Entry point (reducido a ~500 líneas)
├── models/
│   ├── __init__.py
│   ├── business_plan.py   # ✅ CREADO
│   ├── book.py
│   ├── patent.py
│   ├── user.py
│   ├── client.py
│   └── self_petition_v2.py # ✅ EXISTENTE
├── routers/
│   ├── __init__.py        # ✅ ACTUALIZADO
│   ├── auth_router.py     # ✅ CREADO (03/03/2026)
│   ├── business_plans_router.py
│   ├── books_router.py
│   ├── patents_router.py
│   ├── clients_router.py
│   ├── whitepapers_router.py
│   ├── econometric_router.py
│   └── self_petition_v2_router.py # ✅ EXISTENTE
├── services/
│   ├── __init__.py
│   ├── niw_generation_service.py
│   ├── book_generation_service.py
│   ├── patent_generation_service.py
│   ├── evaluation_service.py
│   └── pdf_generation_service.py
├── utils/
│   ├── __init__.py        # ✅ CREADO
│   ├── database.py        # ✅ CREADO
│   ├── llm.py             # ✅ CREADO
│   └── helpers.py
└── prompts/
    ├── niw_prompt_config.py   # ✅ EXISTENTE
    ├── patent_prompt_config.py # ✅ EXISTENTE
    └── book_prompts_uscis.py   # ✅ EXISTENTE
```

## Prioridad de Refactorización

### Fase 1 (Completada)
- [x] Crear estructura de carpetas
- [x] Crear modelos de Business Plans
- [x] Crear utilidades compartidas (database.py, llm.py)

### Fase 2 (Completada 03/03/2026)
- [x] Extraer router de autenticación (auth_router.py)
- [x] Exportar funciones de auth (get_current_user, require_admin, etc.)
- [x] Inicializar database en auth_router desde server.py
- [x] Verificar todos los módulos funcionan (30/30 tests pasaron)

### Fase 2.5 (Completada 03/03/2026)
- [x] Crear router de clientes (clients_router.py)
- [x] Modelos Client y ClientInput exportados
- [x] Router inicializado Y ACTIVADO (43/43 tests)
- [x] Endpoints de clientes ELIMINADOS de server.py (~650 líneas)
- [x] Verificación final (17/17 tests pasaron)

### Fase 3 (Próxima)
- [ ] Extraer router de business-plans (~30 endpoints, ~2000 líneas)
- [ ] Migrar modelos User y Client a models/
- [ ] Extraer lógica de generación a services/

### Fase 4
- [ ] Crear servicio de generación NIW
- [ ] Extraer router de books (~32 endpoints)
- [ ] Extraer router de patents (~31 endpoints)

### Fase 5
- [ ] Extraer routers restantes (whitepapers, econometric)
- [ ] Limpieza final de server.py

## Dependencias Entre Módulos

```
server.py
├── routers/* (todos los routers se registran aquí)
├── models/* (importados por routers)
├── services/* (lógica de negocio)
└── utils/* (funciones compartidas)

routers/*
├── models/* (para type hints)
├── services/* (para lógica de negocio)
└── utils/* (database, llm)

services/*
├── models/* (para validación)
└── utils/* (database, llm)
```

## Notas Importantes

1. **NO romper funcionalidad existente** - Cada cambio debe ser probado
2. **Importaciones circulares** - Evitar importando solo lo necesario
3. **Compatibilidad hacia atrás** - Mantener endpoints existentes funcionando
4. **Hot reload** - Reiniciar backend después de cambios en estructura

## Archivos Modificados en Esta Sesión

1. `/app/backend/routers/auth_router.py` - NUEVO (03/03/2026)
2. `/app/backend/routers/clients_router.py` - NUEVO Y ACTIVADO (03/03/2026)
3. `/app/backend/routers/__init__.py` - ACTUALIZADO
4. `/app/backend/server.py` - ~650 líneas eliminadas (endpoints de clientes)

## Análisis de Complejidad de Módulos Restantes

| Módulo | Endpoints | Complejidad | Dependencias |
|--------|-----------|-------------|--------------|
| business-plans | 31 | ALTA | Generación V1/V3, Brief Builder, Post-processing |
| books | 32 | ALTA | Generación de capítulos, covers, traducciones |
| patents | 34 | ALTA | Generación, diagramas, evaluación |
| whitepapers | 16 | MEDIA | Generación de secciones, CV parsing |
| admin | ~20 | MEDIA | Usuarios, operadores, prompts |
| dashboard | 2 | BAJA | Solo queries |

## Estrategia Recomendada para Siguiente Fase

1. **Opción A:** Extraer `utils/llm_calls.py` con todas las funciones de llamadas a LLM (~10 funciones, ~500 líneas)
2. **Opción B:** Extraer `services/pdf_service.py` con todas las funciones de generación de PDF (~5 funciones, ~800 líneas)
3. **Opción C:** Extraer endpoints CRUD simples de business-plans (listar, obtener, actualizar, eliminar) sin la lógica de generación
