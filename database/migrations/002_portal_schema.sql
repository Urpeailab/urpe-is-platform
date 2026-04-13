-- ============================================================================
-- 002_portal_schema.sql — Tablas del Portal de Clientes (ex-UIS)
-- Gestion de casos EB-2 NIW, pagos, formularios USCIS, citas
-- ============================================================================

-- Casos de visa
CREATE TABLE IF NOT EXISTS visa_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  coordinator_id UUID REFERENCES staff(id),
  advisor_id UUID REFERENCES staff(id),
  case_id TEXT,                              -- ID legible "URPE-2026-0001"
  visa_type TEXT DEFAULT 'EB-2 NIW',
  current_stage INT DEFAULT 1,
  status TEXT DEFAULT 'proceso_venta',       -- proceso_venta, elegibility_approved, en_proceso, completed, on_hold, cancelled
  is_master_case BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_visa_cases_updated BEFORE UPDATE ON visa_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Etapas del caso (7 etapas del proceso EB-2 NIW)
CREATE TABLE IF NOT EXISTS visa_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES visa_cases(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  percentage DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'locked',              -- locked, unlocked, in_progress, completed
  is_paid BOOLEAN DEFAULT FALSE,
  paid_amount DECIMAL(10,2),
  paid_date TIMESTAMPTZ,
  completed_deliverables_count INT DEFAULT 0,
  total_deliverables_count INT DEFAULT 0,
  start_date TIMESTAMPTZ,
  completion_date TIMESTAMPTZ,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entregables por etapa
CREATE TABLE IF NOT EXISTS visa_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES visa_cases(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES visa_stages(id) ON DELETE CASCADE,
  stage_number INT,
  name TEXT,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'pending',             -- pending, uploaded, approved, rejected
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentos del cliente por etapa
CREATE TABLE IF NOT EXISTS visa_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES visa_cases(id) ON DELETE CASCADE,
  stage_number INT,
  document_type TEXT,
  file_url TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'pending',             -- pending, under_review, approved, rejected
  rejection_reason TEXT,
  revision_count INT DEFAULT 0,
  max_revisions INT DEFAULT 2,
  reviewed_by UUID REFERENCES staff(id),
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  stage_number INT,
  stage_numbers INT[],                       -- para pagos multi-etapa
  status TEXT DEFAULT 'pending',             -- pending, completed, failed, refunded
  reference TEXT,
  receipt_url TEXT,
  notes TEXT,
  registered_by UUID REFERENCES staff(id),
  metadata JSONB,
  paid_at TIMESTAMPTZ,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Citas
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  staff_id UUID REFERENCES staff(id),
  title TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  status TEXT DEFAULT 'scheduled',           -- scheduled, completed, cancelled, no_show
  notes TEXT,
  meeting_url TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Formularios USCIS (I-140)
CREATE TABLE IF NOT EXISTS uscis_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  template_id UUID,
  form_type TEXT DEFAULT 'I-140',
  form_data JSONB NOT NULL,                  -- datos del formulario (200+ campos)
  answers JSONB,                             -- respuestas del cliente
  pdf_url TEXT,
  status TEXT DEFAULT 'draft',               -- draft, shared, submitted, approved
  shared_token TEXT,
  submitted_at TIMESTAMPTZ,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates de formularios USCIS
CREATE TABLE IF NOT EXISTS uscis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  form_type TEXT DEFAULT 'I-140',
  fields JSONB NOT NULL,
  questions JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluaciones de elegibilidad
CREATE TABLE IF NOT EXISTS eligibility_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  template_id UUID,
  score DECIMAL(5,2),
  result JSONB,
  report_url TEXT,
  assessed_by UUID REFERENCES staff(id),
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates de elegibilidad
CREATE TABLE IF NOT EXISTS eligibility_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sections JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads / prospectos
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,                               -- whatsapp, web, referral, ad, fanbasis
  status TEXT DEFAULT 'new',                 -- new, contacted, qualified, converted, lost
  assigned_to UUID REFERENCES staff(id),
  visa_type TEXT,
  metadata JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Biblioteca legal
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  file_url TEXT,
  description TEXT,
  uploaded_by UUID REFERENCES staff(id),
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notas de caso
CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES visa_cases(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'general',          -- general, stage_change, payment, document, webhook
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Casos clasicos (legacy pre-EB2)
CREATE TABLE IF NOT EXISTS classic_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  case_type TEXT,
  status TEXT,
  assigned_to UUID REFERENCES staff(id),
  data JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline templates
CREATE TABLE IF NOT EXISTS timeline_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stages JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User timelines (personalizados por usuario)
CREATE TABLE IF NOT EXISTS user_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  case_id UUID REFERENCES visa_cases(id),
  timeline_data JSONB NOT NULL,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comparador de casos
CREATE TABLE IF NOT EXISTS comparator_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  case_type TEXT,
  data JSONB,
  created_by UUID REFERENCES staff(id),
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CVs de usuarios
CREATE TABLE IF NOT EXISTS user_cvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  file_url TEXT NOT NULL,
  file_name TEXT,
  extracted_text TEXT,
  parsed_data JSONB,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings (video calls)
CREATE TABLE IF NOT EXISTS visa_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id),
  client_id UUID REFERENCES clients(id),
  staff_id UUID REFERENCES staff(id),
  meeting_url TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  recording_url TEXT,
  notes TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case audit logs (detallado por caso)
CREATE TABLE IF NOT EXISTS case_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES visa_cases(id),
  staff_id UUID REFERENCES staff(id),
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book preparations (generacion de libros para clientes)
CREATE TABLE IF NOT EXISTS book_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id),
  client_id UUID REFERENCES clients(id),
  profile_summary TEXT,
  selected_idea TEXT,
  selected_title TEXT,
  ideas JSONB,
  titles JSONB,
  status TEXT DEFAULT 'pending',
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book jobs (trabajos de generacion)
CREATE TABLE IF NOT EXISTS book_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES visa_cases(id),
  client_id UUID REFERENCES clients(id),
  title TEXT,
  status TEXT DEFAULT 'queued',              -- queued, processing, completed, failed
  result JSONB,
  file_url TEXT,
  error TEXT,
  mongo_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
