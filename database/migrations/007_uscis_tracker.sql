-- USCIS Tracker Cases table
CREATE TABLE IF NOT EXISTS uscis_tracker_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  form_type TEXT DEFAULT 'I-140',
  client_name TEXT,
  service_center TEXT,
  country_of_origin TEXT,
  status TEXT DEFAULT 'unknown',
  status_title TEXT,
  status_description TEXT,
  status_date TEXT,
  visa_case_id UUID REFERENCES visa_cases(id) ON DELETE SET NULL,
  history JSONB DEFAULT '[]'::jsonb,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  last_status_change_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_uscis_tracker_visa_case ON uscis_tracker_cases(visa_case_id);
CREATE INDEX IF NOT EXISTS idx_uscis_tracker_receipt ON uscis_tracker_cases(receipt_number);
