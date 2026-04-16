-- Add files JSONB column to visa_deliverables for multi-file support
-- Each entry: { id, fileName, fileUrl, fileSize, uploadedBy, uploadedAt }
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';

-- Add missing columns to visa_documents for document names and metadata
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS name JSONB;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS document_name TEXT;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS description JSONB;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS required BOOLEAN DEFAULT FALSE;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS requires_physical_copy BOOLEAN DEFAULT FALSE;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS text_value TEXT;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS input_type TEXT;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';

-- Convert name/description from TEXT to JSONB in visa_stages and visa_deliverables
-- so they properly store {"es": "...", "en": "..."} objects
ALTER TABLE visa_stages ALTER COLUMN name TYPE JSONB USING CASE WHEN name IS NULL THEN NULL WHEN name::text ~ '^\{' THEN name::jsonb ELSE jsonb_build_object('es', name, 'en', name) END;
ALTER TABLE visa_stages ALTER COLUMN description TYPE JSONB USING CASE WHEN description IS NULL THEN NULL WHEN description::text ~ '^\{' THEN description::jsonb ELSE jsonb_build_object('es', description, 'en', description) END;

ALTER TABLE visa_deliverables ALTER COLUMN name TYPE JSONB USING CASE WHEN name IS NULL THEN NULL WHEN name::text ~ '^\{' THEN name::jsonb ELSE jsonb_build_object('es', name, 'en', name) END;
ALTER TABLE visa_deliverables ALTER COLUMN description TYPE JSONB USING CASE WHEN description IS NULL THEN NULL WHEN description::text ~ '^\{' THEN description::jsonb ELSE jsonb_build_object('es', description, 'en', description) END;

-- Add soft-delete columns to case_notes
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES staff(id);
