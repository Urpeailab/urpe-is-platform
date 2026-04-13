-- ============================================================================
-- 001_core_schema.sql — Tablas compartidas entre Portal y Redactora
-- URPE Integral Services Platform
-- ============================================================================

-- Tabla central de clientes (unifica users + clients + wp_contactos + cliente_operaciones)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT,
  name TEXT NOT NULL,
  profession TEXT,
  language TEXT DEFAULT 'es',
  visa_type TEXT DEFAULT 'EB-2 NIW',
  user_state TEXT DEFAULT 'U1',             -- U1 (invitado via magic link), U3 (registrado)
  password_hash TEXT,
  cv_url TEXT,
  original_file_url TEXT,
  is_eligible BOOLEAN DEFAULT FALSE,
  eligible_report JSONB,
  welcome_shown BOOLEAN DEFAULT FALSE,
  advisor_id UUID,                          -- FK agregada despues de crear staff
  -- Referencias de migracion (se eliminan post-migracion)
  mongo_portal_id TEXT,
  mongo_redactora_id TEXT,
  supabase_legacy_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipo URPE (asesores, coordinadores, admins)
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,                        -- super_admin, admin, gerente, coordinador, asesor
  password_hash TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  mongo_id TEXT,                             -- referencia migracion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK diferida: clients.advisor_id → staff.id
ALTER TABLE clients ADD CONSTRAINT fk_clients_advisor FOREIGN KEY (advisor_id) REFERENCES staff(id);

-- Audit trail unificado
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  staff_id UUID REFERENCES staff(id),
  action TEXT NOT NULL,
  entity_type TEXT,                          -- visa_case, patent, payment, etc.
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Magic links para acceso sin registro
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin API tokens
CREATE TABLE IF NOT EXISTS admin_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  token_hash TEXT NOT NULL,
  name TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook notifications
CREATE TABLE IF NOT EXISTS webhook_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
