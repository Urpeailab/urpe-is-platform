# URPE IS Platform

Monorepo unificado de URPE Integral Services — plataforma legaltech para gestion de casos EB-2 NIW.

## Por que es una legaltech

URPE Integral Services usa software, IA y automatizacion para gestionar el proceso completo de solicitud de visa EB-2 NIW a escala. Lo que en un despacho tradicional requiere meses y un equipo grande, aqui ocurre en una plataforma digital que atiende 500+ clientes con un equipo compacto.

## Estructura

```
urpe-is-platform/
  apps/
    portal/          # Portal de clientes (casos, etapas, pagos, admin, formularios USCIS)
    redactora/       # Motor de documentos legales (patentes, NIW, cartas, estudios)
  database/
    migrations/      # Schema SQL para Supabase
    scripts/         # Scripts de migracion de datos
  shared/            # Componentes y utilidades compartidas
```

## Apps

### Portal (`apps/portal/`)
Portal de gestion de casos EB-2 NIW:
- Dashboard del cliente con 7 etapas
- Panel admin con RBAC (5 niveles)
- Formularios USCIS I-140 con generacion de PDF
- Sistema de pagos por etapa
- Magic links (acceso sin registro)
- USCIS tracker/scraper
- Citas, biblioteca legal, reportes de elegibilidad

Stack: FastAPI + React + Supabase

### Redactora (`apps/redactora/`)
Motor de generacion automatizada de documentos legales:
- Patentes USPTO (extraccion, generacion, compliance)
- Peticiones NIW (3 prongs Dhanasar, bilingue)
- Cartas de recomendacion personalizadas
- Estudios econometricos
- Business plans
- Sistema de borradores con versionado

Stack: FastAPI + React + Supabase

## Base de datos

Una sola instancia Supabase (PostgreSQL) con schema relacional:
- `clients` — tabla central compartida por ambas apps
- ~15 tablas Portal (visa_cases, payments, appointments, etc.)
- ~10 tablas Redactora (patents, niw_petitions, recommendation_letters, etc.)
- Vista `client_360` para analytics

## Setup local

```bash
# Instalar deps
cd apps/portal/frontend && npm install
cd apps/portal/backend && pip install -r requirements.txt
cd apps/redactora/frontend && npm install
cd apps/redactora/backend && pip install -r requirements.txt

# Copiar env
cp .env.example .env
# Editar .env con tus credenciales

# Correr migraciones
psql $SUPABASE_URL -f database/migrations/001_core_schema.sql
psql $SUPABASE_URL -f database/migrations/002_portal_schema.sql
psql $SUPABASE_URL -f database/migrations/003_redactora_schema.sql
psql $SUPABASE_URL -f database/migrations/004_indexes.sql
```

## Docker

```bash
docker-compose up --build
# Portal: http://localhost:8001
# Redactora: http://localhost:8002
```

---

URPE Integral Services | urpeintegralservices.co
