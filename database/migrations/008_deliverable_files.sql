-- Add files JSONB column to visa_deliverables for multi-file support
-- Each entry: { id, fileName, fileUrl, fileSize, uploadedBy, uploadedAt }

ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]';
