-- 2026-05-20: Track which Portal cases have been imported into Redactora
--
-- Adds an `is_redactora` boolean flag to the source tables that the
-- Redactora "Importar del Panel" modal searches. When a client is imported
-- into Redactora, the source row is marked `true` so it can be excluded
-- from subsequent searches by default.
--
-- Run this once in Supabase Studio (SQL editor) against the shared project
-- used by both Portal and Redactora. Idempotent.

ALTER TABLE visa_cases
    ADD COLUMN IF NOT EXISTS is_redactora boolean NOT NULL DEFAULT false;

ALTER TABLE classic_cases
    ADD COLUMN IF NOT EXISTS is_redactora boolean NOT NULL DEFAULT false;

-- NOTE: we intentionally do NOT add this column to `public.users` because
-- in this Supabase project `users` is a view over `auth.users`, not a
-- real table. The import flow does not need a flag on users — it marks
-- the case row (visa_cases / classic_cases) instead, which is the unit
-- being imported.

-- Indexes to keep the "show only non-imported" search fast even with
-- hundreds of thousands of rows.
CREATE INDEX IF NOT EXISTS visa_cases_is_redactora_idx
    ON visa_cases (is_redactora)
    WHERE is_redactora = false;

CREATE INDEX IF NOT EXISTS classic_cases_is_redactora_idx
    ON classic_cases (is_redactora)
    WHERE is_redactora = false;
