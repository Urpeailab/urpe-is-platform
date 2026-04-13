-- ============================================================================
-- 003_redactora_schema.sql — Tablas de Monica Redactora (generacion de docs legales)
-- Patentes USPTO, peticiones NIW, cartas de recomendacion, estudios econometricos
-- ============================================================================

-- Patentes USPTO
CREATE TABLE IF NOT EXISTS patents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  title TEXT,
  patent_number TEXT,
  application_number TEXT,
  filing_date TEXT,
  patent_status TEXT DEFAULT 'draft',        -- draft, in_progress, completed, submitted
  inventors TEXT,
  claims JSONB,
  abstract TEXT,
  description TEXT,
  key_innovation TEXT,
  drawings_url TEXT,
  pdf_url TEXT,
  quality_score DECIMAL(3,1),
  model_used TEXT,
  metadata JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_patents_updated BEFORE UPDATE ON patents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Borradores de patentes (historial de versiones)
CREATE TABLE IF NOT EXISTS patent_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id UUID NOT NULL REFERENCES patents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content JSONB NOT NULL,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluaciones de patentes
CREATE TABLE IF NOT EXISTS patent_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_id UUID REFERENCES patents(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  evaluation_data JSONB,
  score DECIMAL(3,1),
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Peticiones NIW
CREATE TABLE IF NOT EXISTS niw_petitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  case_id UUID REFERENCES visa_cases(id),    -- FK al caso del portal
  status TEXT DEFAULT 'draft',               -- draft, in_progress, completed, submitted
  prong_1 TEXT,                              -- substantial merit + national importance
  prong_2 TEXT,                              -- well positioned to advance
  prong_3 TEXT,                              -- beneficial to waive job offer
  full_petition TEXT,
  language TEXT DEFAULT 'en',
  model_used TEXT,
  metadata JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_niw_petitions_updated BEFORE UPDATE ON niw_petitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Borradores NIW (historial de versiones)
CREATE TABLE IF NOT EXISTS niw_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  petition_id UUID NOT NULL REFERENCES niw_petitions(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content JSONB NOT NULL,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartas de recomendacion
CREATE TABLE IF NOT EXISTS recommendation_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  recommender_name TEXT,
  recommender_title TEXT,
  recommender_institution TEXT,
  relationship TEXT,
  content TEXT,
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'draft',               -- draft, completed, approved
  pdf_url TEXT,
  model_used TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_rec_letters_updated BEFORE UPDATE ON recommendation_letters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Estudios econometricos
CREATE TABLE IF NOT EXISTS econometric_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  status TEXT DEFAULT 'draft',               -- draft, in_progress, completed
  analysis_data JSONB,
  conclusions TEXT,
  pdf_url TEXT,
  model_used TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_econometric_updated BEFORE UPDATE ON econometric_studies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Business plans
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  title TEXT,
  status TEXT DEFAULT 'draft',               -- draft, in_progress, completed
  content JSONB,
  pdf_url TEXT,
  model_used TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_business_plans_updated BEFORE UPDATE ON business_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Documentos generados (libros, whitepapers, case studies, policy papers)
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  document_type TEXT NOT NULL,               -- book, whitepaper, case_study, policy_paper, designed_document
  title TEXT,
  status TEXT DEFAULT 'draft',               -- draft, in_progress, completed
  content JSONB,
  pdf_url TEXT,
  file_url TEXT,
  model_used TEXT,
  metadata JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_gen_docs_updated BEFORE UPDATE ON generated_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chat de Monica redactora
CREATE TABLE IF NOT EXISTS redactora_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  conversation_id UUID,
  role TEXT NOT NULL,                        -- user, assistant
  content TEXT NOT NULL,
  has_file BOOLEAN DEFAULT FALSE,
  file_url TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
