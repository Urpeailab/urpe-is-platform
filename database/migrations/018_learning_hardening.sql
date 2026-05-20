-- 018_learning_hardening.sql
-- Refuerzos al módulo de aprendizaje:
--   #8 Versionado de embeddings (saber con qué modelo fue embedido cada chunk)
--   #2 Cleanup de sesiones huérfanas (last_activity_at + status 'abandoned')
--   #4 Snapshot de objetivos en evaluaciones (texto inline, no sólo ID)
--   #9 GDPR: marcar mensajes como redactados sin perder la fila

-- ====================================================================
-- #8 — embedding_model en learning_chunks
-- ====================================================================
ALTER TABLE learning_chunks
  ADD COLUMN IF NOT EXISTS embedding_model TEXT;

-- Backfill: chunks existentes asumimos text-embedding-3-small (era el único
-- modelo en uso hasta ahora). Si cambiás el modelo, podés correr un script de
-- re-embedding y este flag te indica cuáles ya están migrados.
UPDATE learning_chunks
SET embedding_model = 'text-embedding-3-small'
WHERE embedding_model IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_chunks_embedding_model
  ON learning_chunks(embedding_model);

-- ====================================================================
-- #2 — last_activity_at para detectar sesiones huérfanas
-- ====================================================================
ALTER TABLE learning_sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill: usar el created_at del último mensaje, o started_at si no hay mensajes.
UPDATE learning_sessions s
SET last_activity_at = COALESCE(
  (SELECT MAX(created_at) FROM learning_messages WHERE session_id = s.id),
  s.started_at
)
WHERE last_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_sessions_last_activity
  ON learning_sessions(last_activity_at);

-- ====================================================================
-- #4 — Snapshot de objetivos en evaluaciones
-- ====================================================================
-- Las evaluaciones ya guardan objectives_covered como JSONB. Agregamos un campo
-- separado `objectives_snapshot` con el texto de los objetivos del módulo al
-- momento de la evaluación, así si el admin edita los objetivos después, la
-- evaluación vieja sigue siendo legible.
ALTER TABLE learning_evaluations
  ADD COLUMN IF NOT EXISTS objectives_snapshot JSONB;

-- ====================================================================
-- #9 — Redacción de mensajes (GDPR / compliance)
-- ====================================================================
-- `redacted_at` no nulo indica que el contenido fue redactado por compliance.
-- El admin elige si quiere borrar la sesión entera o sólo marcar mensajes
-- individuales como redactados (sin perder la estructura del audit log).
ALTER TABLE learning_messages
  ADD COLUMN IF NOT EXISTS redacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redacted_by UUID,
  ADD COLUMN IF NOT EXISTS redaction_reason TEXT;
