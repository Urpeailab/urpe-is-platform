-- Backfill columns on the webinars table that were never applied from the
-- original 010_webinars.sql migration on this database. Idempotent.

ALTER TABLE webinars ADD COLUMN IF NOT EXISTS title JSONB;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS description JSONB;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'live';
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS duration INT DEFAULT 60;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 100;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS presenter JSONB;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediate';
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'both';
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS registered_count INT DEFAULT 0;
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES staff(id);
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Refresh PostgREST schema cache so the new columns become visible.
NOTIFY pgrst, 'reload schema';
