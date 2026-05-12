-- Payment authorization submissions (public form + admin listing).
-- Migrated from Mongo collection `payment_authorizations`.

CREATE TABLE IF NOT EXISTS payment_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name TEXT NOT NULL,
  payer_address TEXT,
  payer_zip TEXT,
  payer_phone TEXT,
  payer_email TEXT,
  payment_method TEXT,                      -- card | ach
  card_type TEXT,                            -- credit | debit
  card_last_four TEXT,
  bank_name TEXT,
  account_type TEXT,                         -- checking | savings
  account_last_four TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  procedure_type TEXT,
  beneficiary_name TEXT,
  beneficiary_address TEXT,
  beneficiary_zip TEXT,
  is_same_person BOOLEAN DEFAULT FALSE,
  relationship TEXT,
  signature_data_url TEXT,
  agreed_to_terms BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'completed',
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_authorizations_submitted_at ON payment_authorizations(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_status ON payment_authorizations(status);

NOTIFY pgrst, 'reload schema';
