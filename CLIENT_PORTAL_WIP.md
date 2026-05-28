# Client Portal — WIP context

> **Para Claude en la próxima sesión:** este doc reemplaza re-leer la transcripción anterior. Léelo entero y luego revisa los 5 archivos listados en *Files touched*. Branch: `feature/client-portal-mvp`. Última actualización: 2026-05-28.

---

## Qué es esta feature

El jefe (Angelica Monrroy) pidió un portal público donde el cliente abre un link (sin login), ve su NIW generado, **comenta por sección o pide cambios globales**, y al final aprueba o pide PDF. Un agente LLM aplica los comentarios **solo en las secciones comentadas** en hasta **2 rondas**, cada una con un **window de 1 hora desde el primer comentario de la ronda**. No hay email — el cliente refresca el link y ve el estado.

Diseño visual: editorial elite (Cleary/Cravath vibe). El jefe entregó `niw_gen_publish.py` como referencia (CLI que parseaba DOCX). Lo adaptamos a leer NIWs directo de la BD (`business_plans.sections`).

---

## Estado: qué está hecho, qué no

| Fase | Qué | Estado |
|---|---|---|
| 1 | `POST /api/business-plans/{niw_id}/publish` (admin) + `GET /p/{slug}` (público read-only) | ✅ |
| 2 | Endpoints públicos `/comment` `/approve` `/download.pdf` + state machine de rondas | ✅ |
| 3 | Agente APScheduler que aplica comentarios `kind='section'` via `call_openai_gpt5` | ✅ |
| 4 | Botón "Compartir con cliente" en `ViewBusinessPlan.js` + modal copiable | ✅ |
| — | Migración SQL aplicada en Supabase production | ✅ (corrida por felix) |
| 5 | Comentarios `kind='global'` se aplican automáticamente | ❌ (marcados `pending_manual`, decisión consciente — ver "Decisiones") |
| 6 | Bandeja en el panel admin para ver comentarios recibidos del cliente | ❌ |
| 7 | Email/webhook al operador cuando llega comentario o falla LLM | ❌ |
| 8 | Visor cliente muestra cuánto falta del window de 1h | ❌ (cosmético) |

**No se hizo merge a `dev-felix` ni `main`** — la rama vive en `feature/client-portal-mvp`. El usuario la separó para arreglar bugs urgentes de producción en `dev-felix`.

---

## Arquitectura

```
                       FRONTEND REDACTORA
ViewBusinessPlan.js ──► POST /api/business-plans/{id}/publish ──┐
  "🔗 Compartir con cliente" → modal con link copiable          │
                                                                 ▼
                                              redactora_portal_publications
                                              (id, niw_id, slug, token, status, round, data)
                                                                 │
                              ┌──────────────────────────────────┘
                              │
                              ▼
PUBLIC VIEWER (no auth, ?token=…)
GET /p/{slug}?token=…  ──►  portal_publish.render_portal_html()
                              ├── lee NIW.sections desde business_plans
                              ├── status → can_comment / banner via _portal_status_view
                              └── HTML editorial: sidebar TOC + secciones + modales

CLIENT INTERACTIONS (público, slug+token validan)
POST /api/portal/{slug}/comment   ──► insert redactora_portal_comments
                                       + transición de estado (state machine)
POST /api/portal/{slug}/approve   ──► status='approved' (terminal)
GET  /api/portal/{slug}/download.pdf ──► delega a download_business_plan_pdf

CORRECTION AGENT (APScheduler, cada 2 min)
_portal_correction_agent()
  ├── busca pubs en round{N}_collecting con window vencido
  ├── transición → round{N}_correcting (guard: status=current_status)
  ├── _portal_apply_round() ──► call_openai_gpt5 por sección
  └── transición → round1_done | closed
```

### Contrato visor ↔ agente: `portal_publish.section_slug()`

Es lo más frágil: si lo cambias, rompes los comentarios ya guardados.

```python
# portal_publish.py
def section_slug(title: str, number) -> str:
    s = re.sub(r'[^a-z0-9]+', '-', (title or '').lower()).strip('-')[:50]
    return s or f'seccion-{number}'
```

- El visor emite el slug en el `onclick` del botón "Comentar" de cada sección.
- El cliente lo manda al POST `/comment` como `section_id`.
- El agente busca la sección en `niw.sections` calculando el mismo slug sobre cada `section.title`/`section.number`.

Smoke test (verifica visor↔agente):
```python
slug = pp.section_slug('I. Executive Summary', 1)  # → 'i-executive-summary'
```

---

## State machine

```
draft_published
  └─(primer comment)──► round1_collecting (set data.round1_started_at=now)
                          └─(window cerrado, agente)──► round1_correcting
                                                          └─(LLM termina)──► round1_done
                                                                              └─(nuevo comment)──► round2_collecting
                                                                                                    └─(window)──► round2_correcting
                                                                                                                    └──► closed (terminal)

(en cualquier estado no-correcting): approve ──► approved (terminal)
```

- `PORTAL_WINDOW_HOURS = 1`
- `PORTAL_CORRECTING_STATES = {round1_correcting, round2_correcting}` — durante esto: 409 a comments/approve
- `PORTAL_TERMINAL_STATES = {closed, approved}`
- `_portal_next_state_on_comment(status)` retorna `(new_state, round, set_window_now, accept)`
- `_portal_status_view(status)` retorna `(can_comment, label, banner)` para el render

| status | can_comment | UX |
|---|---|---|
| draft_published | ✅ | "Borrador" |
| round1_collecting | ✅ | "Comentarios — ronda 1" |
| round1_correcting | ❌ | "Aplicando ronda 1" |
| round1_done | ✅ | "Ronda 1 aplicada" |
| round2_collecting | ✅ | "Comentarios — ronda 2 (final)" |
| round2_correcting | ❌ | "Aplicando ronda 2" |
| closed | ❌ | "Comentarios cerrados" |
| approved | ❌ | "Aprobado" |

---

## DB schema (ya migrado en Supabase)

```sql
-- migrations/2026-05-27_portal_publications.sql (aplicada)
CREATE TABLE redactora_portal_publications (
    id text PRIMARY KEY,
    niw_id text NOT NULL,
    doc_collection text DEFAULT 'business_plans',
    slug text UNIQUE NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'draft_published',
    round integer DEFAULT 0,
    created_at timestamptz, updated_at timestamptz,
    data jsonb DEFAULT '{}'
);
-- + índices: slug, niw_id, status

CREATE TABLE redactora_portal_comments (
    id text PRIMARY KEY,
    publication_id text NOT NULL,
    niw_id text NOT NULL,
    round integer DEFAULT 1,
    kind text DEFAULT 'section',   -- 'section' | 'global'
    section_id text,
    lang text DEFAULT 'en',
    comment text NOT NULL,
    status text DEFAULT 'pending', -- pending | applied | pending_manual | error
    created_at timestamptz,
    data jsonb DEFAULT '{}'
);
-- + índices: publication_id, (publication_id, round)
```

### Campos del `data` JSONB de `portal_publications`
Surface columns están en `mongo_compat.SURFACE_COLUMNS["portal_publications"]`. Todo lo demás va a `data`:
- `client_name`, `client_email`, `case_id`, `attorney`, `version`, `published_by`
- `round1_started_at`, `round2_started_at` (ISO strings) — el agente las parsea con `datetime.fromisoformat`
- `approved_at` (cuando aplica)

---

## API contract

### Admin (JWT)
```
POST /api/business-plans/{niw_id}/publish
Body: { client_name?, client_email?, case_id?, attorney?, version? }
→ { id, slug, token, url: "/p/{slug}?token=...", status: "draft_published" }
```
Verifica `niw.user_id == current_user.id` o `current_user.role == "ADMIN"`. NO reusa publicaciones — cada llamada crea una nueva. El frontend (ViewBusinessPlan.js) cachea el `publishedUrl` en memoria para no regenerar mientras el modal está abierto.

### Público (?token=…)
```
GET  /p/{slug}?token=...                  → HTML editorial
POST /api/portal/{slug}/comment?token=... → { kind, section_id?, lang?, comment }
POST /api/portal/{slug}/approve?token=... → {}
GET  /api/portal/{slug}/download.pdf?token=... → PDF
```

El token se valida con `hmac.compare_digest` (constant-time). El visor JS embebe slug+token en `window.PORTAL_SLUG/PORTAL_TOKEN` y arma las URLs con `window.location.origin + '/api/portal/' + slug + path`.

---

## Files touched

| Archivo | Cambio |
|---|---|
| `apps/redactora/backend/migrations/2026-05-27_portal_publications.sql` | **Nuevo**. Migración corrida en Supabase. |
| `apps/redactora/backend/portal_publish.py` | **Nuevo**, ~550 líneas. `section_slug()`, `make_slug()`, `make_token()`, `make_fingerprint()`, `niw_to_sections()`, `render_portal_html()`. Adaptado de `niw_gen_publish.py` del jefe. |
| `apps/redactora/backend/db/mongo_compat.py` | Líneas ~161-164: 2 entradas en `SURFACE_COLUMNS` para `portal_publications` y `portal_comments`. |
| `apps/redactora/backend/server.py` | Bloque nuevo justo antes de `app.include_router(api_router)` (~línea 44147): constants + helpers + endpoints publish/viewer/comment/approve/download + agente Fase 3. Job `portal_correction_agent` registrado en `start_trash_cleanup_scheduler` (línea ~41019). |
| `apps/redactora/frontend/src/pages/ViewBusinessPlan.js` | Import `Share2`/`ExternalLink`; states `publishing`/`showPublishModal`/`publishedUrl`; handler `publishForClient()` después de `downloadPDF()`; botón "🔗 Compartir con cliente" en toolbar después de Comentarios; Dialog modal al final del JSX. |

---

## Cómo probarlo (manual, 5 min)

1. **Restart backend redactora** (recoge imports nuevos + scheduler).
2. Abrir un NIW completo → toolbar → "🔗 Compartir con cliente" → modal con URL → "Abrir" en pestaña incógnito.
3. Verificar badge "Borrador" + botones activos (no `disabled`).
4. Comentar una sección → modal de éxito.
5. **Acelerar el window de 1h** (Supabase Studio SQL editor):
   ```sql
   UPDATE redactora_portal_publications
   SET data = jsonb_set(data, '{round1_started_at}', to_jsonb((now() - interval '61 minutes')::text))
   WHERE slug = 'TU-SLUG';
   ```
6. Esperar ≤ 2 min → logs:
   ```
   [portal] {slug} ventana ronda 1 cerrada — aplicando comentarios
   [portal] {slug} aplicó N comentario(s) a sección X
   [portal] {slug} ronda 1 cerrada → round1_done
   ```
7. Refrescar visor cliente → debe ver la sección regenerada + banner "Ronda 1 aplicada".

---

## Decisiones de diseño (NO revertir sin entender)

1. **Comentarios `kind='global'` NO se auto-aplican.** Riesgo alto de romper coherencia entre 19 secciones con un único prompt. Se marcan `status='pending_manual'` en `portal_comments` y los aplica el operador con `/business-plans/{id}/ai-edit` existente. Si en el futuro se quiere automatizar, sería un "router LLM" que decide qué secciones tocar — feature aparte.

2. **`max_instances=1` en el job APScheduler.** Garantiza que nunca dos ticks corren en paralelo. Cero races.

3. **Guard optimista `update_one({slug, status: pub.status})`.** Si dos ticks del agente corren concurrentes y ambos intentan transicionar la misma pub, solo uno mueve `modified_count=1`; el otro ve 0 y aborta. Robusto.

4. **Idioma por mayoría en LLM apply.** Si 3 comments están en `es` y 1 en `en` sobre la misma sección, regeneramos solo `content_es`; el `content_en` queda intacto (la traducción canónica se regenera por separado en otro pipeline).

5. **No reusamos publicaciones.** Cada POST `/publish` crea slug+token nuevo. El frontend cachea `publishedUrl` en memoria para no regenerar al reabrir el modal. Cerrar y reabrir la página fuerza nueva publicación (decisión: el operador decide cuándo "cortar").

6. **`download_business_plan_pdf` se reusa directo.** No requiere JWT (público por diseño). Validamos token del portal antes de delegar. No duplicamos lógica de PDF.

7. **`section_slug` debe ser idéntico en visor y agente.** Está expuesto como función pública en `portal_publish.py` y se importa en `server.py` con alias `_portal_section_slug`. Si lo cambias, los comentarios viejos se vuelven huérfanos (el agente no encuentra la sección).

8. **El visor pide `?token=`, no header.** Es link-shareable. Quien tenga la URL completa, ve el documento. Constant-time compare evita timing oracles. El UX del modal en el frontend ya avisa que "no lo publiques en canales abiertos".

---

## Bugs conocidos / pendientes

- **No hay UI para ver los comentarios recibidos del cliente.** Quedan en `redactora_portal_comments` con `status='applied'`/`pending_manual`/`error`. Falta bandeja en panel admin.
- **No hay notificación al operador.** Si el LLM falla en alguna sección durante una ronda, queda `status='error'` en el comment con `data.error` pero nadie se entera salvo por logs. Habría que mandar webhook/email al `attorney` o al `published_by`.
- **El visor no muestra cuántos minutos quedan del window.** El cliente puede no saber que tiene "59 minutos antes de que esto se cierre". Cosmético: el banner ya explica el flujo en general.
- **No hay test automatizado de la cadena completa.** Probé `section_slug` + state machine helpers con smoke tests inline. Falta pytest real para `_portal_apply_round` (con mock de `call_openai_gpt5`).

---

## Para retomar trabajo

Si quieres seguir en orden de impacto:
1. **Bandeja de comentarios en panel admin** (Fase 6) — el operador necesita ver qué pidió el cliente, especialmente los `pending_manual` globales.
2. **Notificación al operador** cuando llega comment o falla LLM (Fase 7).
3. **Tests de pytest** para el agente con mocks (preserve confidence).
4. **Countdown del window** en el visor (Fase 8).

Si surge un bug del portal: revisar `logging` con prefijo `[portal]`, todos los puntos críticos están instrumentados.
