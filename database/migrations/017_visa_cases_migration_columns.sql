-- ============================================================================
-- 017_visa_cases_migration_columns.sql
-- Columnas que necesita el endpoint POST /api/admin/migration/visa-cases-import
-- para hospedar el payload de la instancia origen SIN perder data importante.
-- Campos no críticos (tags, customFields) viven en metadata JSONB.
-- ============================================================================

-- visa_cases: progreso, fees y hitos del ciclo de vida
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS overall_progress  INT;
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS total_fee         DECIMAL(10,2);
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS paid_amount       DECIMAL(10,2);
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(10,2);
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS eligibility_date  TIMESTAMPTZ;
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS filed_at          TIMESTAMPTZ;
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ;
ALTER TABLE visa_cases ADD COLUMN IF NOT EXISTS case_level_notes  TEXT;

-- user_cvs: trazabilidad de subida (uploaded_by, uploaded_at, is_active)
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES staff(id);
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
ALTER TABLE user_cvs ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;

-- visa_stages: timestamps de unlock/complete
ALTER TABLE visa_stages ADD COLUMN IF NOT EXISTS unlocked_at  TIMESTAMPTZ;
ALTER TABLE visa_stages ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- visa_deliverables: trazabilidad + draft
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS deliverable_name TEXT;
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS file_size        BIGINT;
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS uploaded_at      TIMESTAMPTZ;
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS uploaded_by      UUID REFERENCES staff(id);
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS validated_at     TIMESTAMPTZ;
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS validated_by     UUID REFERENCES staff(id);
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE visa_deliverables ADD COLUMN IF NOT EXISTS is_draft         BOOLEAN DEFAULT FALSE;

-- visa_documents: tamaño + timestamps que no estaban
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS file_size   BIGINT;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
ALTER TABLE visa_documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- case_notes: metadata para isAutomatic/isTestEnvironment/category
ALTER TABLE case_notes ADD COLUMN IF NOT EXISTS metadata JSONB;

-- magic_links: phone (lookup por phone es como el validate-magic-link encuentra al cliente)
ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_magic_links_phone ON magic_links (phone) WHERE phone IS NOT NULL;

-- Índices para lookups rápidos durante la migración (donde mongo_id matchea)
CREATE INDEX IF NOT EXISTS idx_visa_cases_mongo_id        ON visa_cases        (mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_mongo_portal_id    ON clients           (mongo_portal_id) WHERE mongo_portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visa_stages_mongo_id       ON visa_stages       (mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visa_deliverables_mongo_id ON visa_deliverables (mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visa_documents_mongo_id    ON visa_documents    (mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_mongo_id          ON payments          (mongo_id) WHERE mongo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_notes_mongo_id        ON case_notes        (mongo_id) WHERE mongo_id IS NOT NULL;
