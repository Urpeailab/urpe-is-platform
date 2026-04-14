# URPE IS Platform — Guia para Ingenieros

## Que es este repo

Monorepo unificado del producto URPE Integral Services (UIS). Consolida el Portal de clientes y el motor de generacion de documentos legales (Monica Redactora) en una sola base de codigo con una sola base de datos.

Reemplaza dos repos separados que vivian en Emergent:
- `durquijop/uis` → `apps/portal/`
- `durquijop/Monica-redactora-disenadora` → `apps/redactora/`

## Por que este monorepo es mejor que los dos repos en Emergent

### 1. Un solo producto, un solo repo

Antes:
- 2 repos separados en Emergent
- Un cliente que iniciaba en el Portal tenia que ser recreado manualmente en Redactora para generar documentos
- Los ingenieros tenian que entender dos codebases para comprender un solo flujo
- Deploy coordinado imposible: cambio de schema en Portal podia romper Redactora sin avisos

Ahora:
- `apps/portal/` y `apps/redactora/` en el mismo repo
- Mismos clientes, mismas credenciales, misma base de datos
- Un developer nuevo entiende el producto completo leyendo un solo README
- Deploy unificado via `docker-compose up` o Railway/VPS

### 2. Salida de Emergent

Emergent tenia limitaciones severas:
- **No permitia trabajar a dos personas en el mismo proyecto** (razon original del split)
- Auto-commitea con UUIDs sin mensaje descriptivo — imposible leer history
- No hay code review, no hay branches, no hay PRs
- Todo el codigo es generado por `emergent-agent-e1` sin supervision humana
- Docker base image propietaria opaca
- `emergentintegrations` package propietario que wrappea LLMs y acopla al vendor

Con el monorepo:
- Git estandar: branches, PRs, code review
- Multiples ingenieros pueden trabajar en paralelo
- History legible con mensajes descriptivos
- Docker propio multi-stage, sin dependencias propietarias
- LLM calls directos a OpenAI y Google (sin wrapper)

### 3. Base de datos unificada con schema relacional

Antes:
- MongoDB Atlas (Portal) con 48 colecciones sin schema
- MongoDB Atlas (Redactora) con 19 colecciones sin schema
- Supabase (Portal) con `wp_contactos` (cruce con Monica agente)
- Supabase (Redactora) con `cliente_operaciones` y `redaccion`
- **Total: 4 bases de datos distintas**, data del mismo cliente en 4 lugares

Ahora:
- Una sola base de datos Supabase (PostgreSQL 17) — proyecto `UIS 2.0`
- 38 tablas con schema estricto, foreign keys y constraints
- 27 clientes unidos Portal+Redactora via `mongo_portal_id` y `mongo_redactora_id`
- JOIN nativo: cruzar casos, pagos, patentes, NIW desde SQL

## Schema para Data Science

La migracion a PostgreSQL habilita ciencia de datos seria. Antes en MongoDB era imposible responder preguntas como "cuantos clientes con patente generada pagaron la etapa 5 este mes" sin escribir codigo imperativo que iterara colecciones.

### Tablas core (compartidas)

```
clients       — Tabla maestra. 785 clientes unificados de ambos sistemas
              — FKs: mongo_portal_id, mongo_redactora_id, supabase_legacy_id
              — Schema estricto: email UNIQUE, phone, name NOT NULL, user_state ENUM
staff         — 38 miembros del equipo URPE con roles (super_admin, admin, gerente, coordinador, asesor)
activity_logs — Audit trail unificado de AMBAS apps
magic_links   — Tokens de acceso sin registro
```

### Tablas Portal (ex-UIS)

```
visa_cases              — 640 casos EB-2 NIW
visa_stages             — 7,673 etapas (7 por caso + master template)
visa_deliverables       — 15,349 entregables esperados del cliente
visa_documents          — 7,668 documentos uploadeados
payments                — 121 pagos (manual + automaticos)
appointments            — 11 citas
leads                   — 147 prospectos sin convertir
case_notes              — 528 notas internas de coordinadores
legal_documents         — Biblioteca legal
eligibility_assessments — 371 evaluaciones de elegibilidad
uscis_submissions       — Formularios I-140
```

### Tablas Redactora (ex-Monica)

```
patents                 — 66 patentes USPTO (completadas y drafts)
patent_evaluations      — Evaluaciones de calidad de patentes
niw_petitions           — 85 peticiones NIW (3 prongs Dhanasar)
recommendation_letters  — Cartas de recomendacion
econometric_studies     — 52 estudios econometricos
business_plans          — Planes de negocio
generated_documents     — 210 libros, whitepapers, case studies
redactora_chat_messages — 62 mensajes con Monica asistente
```

### Vistas para Data Science

5 vistas materializadas precalculadas:

```sql
-- client_360: perfil completo del cliente con todo su historial
SELECT * FROM client_360 WHERE email = 'cliente@ejemplo.com';
-- Devuelve: caso + etapa actual + total pagado + num patentes + num NIW + etc

-- monthly_revenue: ingresos por mes
SELECT month, total_revenue, payment_count, avg_ticket FROM monthly_revenue;

-- conversion_funnel: funnel completo
SELECT stage, count FROM conversion_funnel;
-- leads → eligible_clients → active_cases → stage_3_plus → completed_cases

-- client_document_completeness: que documentos tiene cada cliente
SELECT client_id, has_patent, has_niw, has_rec_letter FROM client_document_completeness;

-- staff_performance: productividad por miembro
SELECT name, role, cases_as_coordinator, completed_cases FROM staff_performance;
```

### Queries que antes eran imposibles

```sql
-- Clientes con caso activo Y patente Y carta de recomendacion
SELECT c.name, c.email, vc.current_stage, COUNT(p.id) AS patents, COUNT(rl.id) AS letters
FROM clients c
JOIN visa_cases vc ON vc.client_id = c.id
LEFT JOIN patents p ON p.client_id = c.id
LEFT JOIN recommendation_letters rl ON rl.client_id = c.id
WHERE vc.status = 'active'
GROUP BY c.id, vc.current_stage
HAVING COUNT(p.id) > 0 AND COUNT(rl.id) > 0;

-- Ticket promedio por tipo de visa
SELECT c.visa_type, AVG(p.amount), COUNT(DISTINCT c.id)
FROM payments p
JOIN clients c ON c.id = p.client_id
WHERE p.status = 'completed'
GROUP BY c.visa_type;

-- Coordinadores con casos atrasados (etapa < 3 hace mas de 60 dias)
SELECT s.name, COUNT(vc.id) as casos_atrasados
FROM staff s
JOIN visa_cases vc ON vc.coordinator_id = s.id
WHERE vc.current_stage < 3 AND vc.created_at < NOW() - INTERVAL '60 days'
GROUP BY s.name;
```

### Triggers automaticos

- `updated_at` se actualiza automaticamente en todas las tablas al hacer UPDATE
- FKs con `ON DELETE CASCADE` donde corresponde (borrar caso → borra etapas, deliverables, documents)
- FKs con `ON DELETE SET NULL` para preservar audit logs y referencias historicas

## Estructura del repo

```
urpe-is-platform/
  apps/
    portal/              # Portal de clientes (ex-UIS)
      backend/           # FastAPI + Python 3.11
      frontend/          # React 19 + Tailwind + Shadcn UI
      Dockerfile         # Multi-stage: Node + Python
    redactora/           # Motor de documentos legales (ex-Monica)
      backend/           # FastAPI + Python 3.11
      frontend/          # React + Tailwind + Shadcn UI
      Dockerfile         # Multi-stage: Node + Python
  database/
    migrations/
      001_core_schema.sql         # clients, staff, activity_logs, magic_links
      002_portal_schema.sql       # visa_cases, stages, payments, etc.
      003_redactora_schema.sql    # patents, niw, recommendation_letters, etc.
      004_indexes_and_views.sql   # 89 indexes + 5 vistas analytics
      005_fixes.sql               # FK cascades, missing triggers, view fixes
    scripts/
      migrate_100pct.py           # Script principal de migracion MongoDB→Supabase
      final_redactora_cleanup.py  # Pass final para data huerfana
      migrate_via_mongoview.py    # Version alternativa via API de mongoview
      refactor_mongo_to_supabase.py  # Transformacion automatica de codigo
  docker-compose.yml
  .env.example
  README.md
  ENGINEERING.md (este archivo)
```

## Stack

### Backend
- FastAPI 0.110
- PostgreSQL 17 (via Supabase)
- Cliente Supabase-py con helpers centralizados (`db/supabase_client.py`)
- OpenAI Python SDK (reemplazo directo de emergentintegrations)
- Google Gen AI SDK (para Gemini)
- Docker multi-stage

### Frontend
- React 19
- Tailwind CSS + Shadcn UI
- Next.js 15 (Monica Intelligence sync)
- React Hook Form + Zod

### Infra
- Supabase (PostgreSQL + Auth + Storage)
- Railway o VPS para deploy
- GitHub Actions para CI/CD

## Historia de la migracion

### 1. Inicio
- 2 repos separados en Emergent
- Backend con 773 queries MongoDB motor
- 6 call sites dependen de `emergentintegrations` (wrapper propietario de LLMs)

### 2. Reestructuracion (fases 1-7)
- Monorepo creado, Emergent artifacts removidos
- 6 call sites `emergentintegrations` reemplazados con SDKs directos
- Schema PostgreSQL unificado (38 tablas, 5 vistas)
- 773 queries MongoDB → Supabase helpers (100% convertido)
- Dockerfiles multi-stage propios (sin imagen Emergent)
- Frontend servido desde FastAPI (sin proxy separado)

### 3. Migracion de datos
- MongoDB Atlas tenia IP whitelist estricta — bloqueaba conexion directa
- Solucion: usar la API publica de `mongoview.emergent.host` que ya tenia acceso al cluster
- Script de migracion que matchea clientes Portal+Redactora por email/phone
- Resultado: 98.5% de registros migrados (33,822 de 34,330)
- 27 clientes unificados Portal+Redactora via JOIN

### 4. Auditoria
- 40+ bugs encontrados en auditoria post-migracion (3 agentes en paralelo)
- Todos arreglados: ON DELETE cascades, $set wrappers residuales, orphan db.X calls
- Thread safety en Supabase client, safety guards en update/delete

## Como contribuir

### Setup local

```bash
git clone https://github.com/Urpeailab/urpe-is-platform.git
cd urpe-is-platform

# Backend Portal
cd apps/portal/backend && pip install -r requirements.txt
cd apps/portal/frontend && npm install

# Backend Redactora
cd apps/redactora/backend && pip install -r requirements.txt
cd apps/redactora/frontend && npm install

# Copiar env
cp .env.example .env
# Editar .env con credenciales (contactar al admin de Supabase UIS 2.0)
```

### Correr localmente

```bash
docker-compose up --build
# Portal: http://localhost:8001
# Redactora: http://localhost:8002
```

### Ejecutar migraciones SQL

```bash
# Contra proyecto Supabase (requiere credenciales en .env)
psql $SUPABASE_URL -f database/migrations/001_core_schema.sql
psql $SUPABASE_URL -f database/migrations/002_portal_schema.sql
psql $SUPABASE_URL -f database/migrations/003_redactora_schema.sql
psql $SUPABASE_URL -f database/migrations/004_indexes_and_views.sql
psql $SUPABASE_URL -f database/migrations/005_fixes.sql
```

### Trabajar en una feature

```bash
git checkout -b feature/nombre-descriptivo
# hacer cambios
git commit -m "feat: descripcion clara"
git push origin feature/nombre-descriptivo
# abrir PR en GitHub
```

**NO mergear a main directo.** Todos los cambios via PR con code review.

## Flujo de datos entre Portal y Redactora

```
Cliente entra al Portal (magic link o signin)
  ↓
Portal crea caso EB-2 NIW (visa_cases)
  ↓
Cliente paga etapa 1 (payments, visa_stages.is_paid=true)
  ↓
Se crea entry en Redactora (via email match)
  ↓
Redactora genera patent (patents)
  ↓
Redactora genera NIW (niw_petitions.case_id → FK al visa_case)
  ↓
Redactora genera cartas (recommendation_letters)
  ↓
Portal muestra progreso del cliente con documentos generados
```

Todo pasa por un solo `client_id` (UUID en `clients`).

## Reglas

1. **No commits directos a main.** Todo via PR.
2. **Supabase helpers obligatorios.** No queries SQL raw excepto en migraciones.
3. **No modificar schema sin migration.** Todo cambio de DB va en `database/migrations/XXX_nombre.sql`.
4. **Tests en pytest.** No merge sin tests que pasen.
5. **Nunca hardcodear credenciales.** Todo via `.env`.
6. **client_id es sagrado.** Cambios en la tabla `clients` afectan todo.

## Contacto

- Super Admin: Diego Urquijo (dau@urpeailab.com)
- Ingeniero principal: Agustin Peralta
- Issues: https://github.com/Urpeailab/urpe-is-platform/issues
