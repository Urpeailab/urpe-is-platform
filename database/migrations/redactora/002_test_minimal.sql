-- Minimal test: function + users table only
-- Run this in Supabase SQL Editor and check for errors

CREATE OR REPLACE FUNCTION redactora_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS redactora_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  password TEXT,
  language_preference TEXT DEFAULT 'es',
  permissions JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redactora_users_email ON redactora_users(email);
CREATE INDEX IF NOT EXISTS idx_redactora_users_status ON redactora_users(status);

DROP TRIGGER IF EXISTS trg_redactora_users_updated ON redactora_users;
CREATE TRIGGER trg_redactora_users_updated BEFORE UPDATE ON redactora_users
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- Sanity check: this SHOULD return the new table
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'redactora_users';
