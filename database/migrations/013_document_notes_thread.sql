-- Threaded notes (history) for client documents.
-- Each entry: { id, text, visibleToClient, createdBy, createdByName, createdAt }
-- Legacy single-note columns (note, note_visible_to_client, ...) stay for
-- backward compatibility; the backend exposes them as a synthetic first entry
-- when "notes" is empty.
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;
