-- Extend eligibility_assessments to support admin test reports.
-- Test reports have no real client_id (they're triggered from the admin
-- panel before a person becomes a client), and they record additional
-- metadata about the test run and the N8N webhook response.

ALTER TABLE eligibility_assessments ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS test_name TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS test_email TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS cv_url TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS created_by JSONB;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS webhook_status INT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS webhook_response TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS report_data JSONB;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE eligibility_assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_eligibility_assessments_is_test ON eligibility_assessments(is_test);
CREATE INDEX IF NOT EXISTS idx_eligibility_assessments_status ON eligibility_assessments(status);

NOTIFY pgrst, 'reload schema';
