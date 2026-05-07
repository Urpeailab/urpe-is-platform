-- Adds staff-authored notes (with per-note client visibility) to client documents.
-- The deliverable equivalent lives inside the existing visa_deliverables.files JSONB,
-- so no schema change is needed there.

ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS note_visible_to_client BOOLEAN DEFAULT FALSE;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS note_updated_by UUID;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;
