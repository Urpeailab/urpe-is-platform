-- ============================================================================
-- 005_fixes.sql — Bug fixes from audit
-- Fixes ON DELETE CASCADE/SET NULL, missing FKs, missing triggers
-- ============================================================================

-- === FK cascades (drop and recreate with proper behavior) ===

-- activity_logs: preserve log, nullify references
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_client_id_fkey;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_staff_id_fkey;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- magic_links: cascade delete with client
ALTER TABLE magic_links DROP CONSTRAINT IF EXISTS magic_links_client_id_fkey;
ALTER TABLE magic_links ADD CONSTRAINT magic_links_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- clients.advisor_id: nullify if staff deleted
ALTER TABLE clients DROP CONSTRAINT IF EXISTS fk_clients_advisor;
ALTER TABLE clients ADD CONSTRAINT fk_clients_advisor
  FOREIGN KEY (advisor_id) REFERENCES staff(id) ON DELETE SET NULL;

-- payments: cascade with case and client
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_case_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_client_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- appointments: cascade
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_case_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- uscis_submissions: cascade
ALTER TABLE uscis_submissions DROP CONSTRAINT IF EXISTS uscis_submissions_case_id_fkey;
ALTER TABLE uscis_submissions ADD CONSTRAINT uscis_submissions_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

ALTER TABLE uscis_submissions DROP CONSTRAINT IF EXISTS uscis_submissions_client_id_fkey;
ALTER TABLE uscis_submissions ADD CONSTRAINT uscis_submissions_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Template FKs (were missing)
ALTER TABLE uscis_submissions DROP CONSTRAINT IF EXISTS uscis_submissions_template_id_fkey;
ALTER TABLE uscis_submissions ADD CONSTRAINT uscis_submissions_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES uscis_templates(id) ON DELETE SET NULL;

ALTER TABLE eligibility_assessments DROP CONSTRAINT IF EXISTS eligibility_assessments_template_id_fkey;
ALTER TABLE eligibility_assessments ADD CONSTRAINT eligibility_assessments_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES eligibility_templates(id) ON DELETE SET NULL;

-- eligibility_assessments: cascade
ALTER TABLE eligibility_assessments DROP CONSTRAINT IF EXISTS eligibility_assessments_client_id_fkey;
ALTER TABLE eligibility_assessments ADD CONSTRAINT eligibility_assessments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- user_cvs: cascade
ALTER TABLE user_cvs DROP CONSTRAINT IF EXISTS user_cvs_client_id_fkey;
ALTER TABLE user_cvs ADD CONSTRAINT user_cvs_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- visa_meetings: cascade
ALTER TABLE visa_meetings DROP CONSTRAINT IF EXISTS visa_meetings_case_id_fkey;
ALTER TABLE visa_meetings ADD CONSTRAINT visa_meetings_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

ALTER TABLE visa_meetings DROP CONSTRAINT IF EXISTS visa_meetings_client_id_fkey;
ALTER TABLE visa_meetings ADD CONSTRAINT visa_meetings_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- case_audit_logs: cascade with case
ALTER TABLE case_audit_logs DROP CONSTRAINT IF EXISTS case_audit_logs_case_id_fkey;
ALTER TABLE case_audit_logs ADD CONSTRAINT case_audit_logs_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

-- book_preparations + book_jobs: cascade
ALTER TABLE book_preparations DROP CONSTRAINT IF EXISTS book_preparations_case_id_fkey;
ALTER TABLE book_preparations ADD CONSTRAINT book_preparations_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

ALTER TABLE book_preparations DROP CONSTRAINT IF EXISTS book_preparations_client_id_fkey;
ALTER TABLE book_preparations ADD CONSTRAINT book_preparations_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE book_jobs DROP CONSTRAINT IF EXISTS book_jobs_case_id_fkey;
ALTER TABLE book_jobs ADD CONSTRAINT book_jobs_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE CASCADE;

ALTER TABLE book_jobs DROP CONSTRAINT IF EXISTS book_jobs_client_id_fkey;
ALTER TABLE book_jobs ADD CONSTRAINT book_jobs_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- patent_evaluations: cascade
ALTER TABLE patent_evaluations DROP CONSTRAINT IF EXISTS patent_evaluations_patent_id_fkey;
ALTER TABLE patent_evaluations ADD CONSTRAINT patent_evaluations_patent_id_fkey
  FOREIGN KEY (patent_id) REFERENCES patents(id) ON DELETE CASCADE;

-- niw_petitions.case_id: cascade
ALTER TABLE niw_petitions DROP CONSTRAINT IF EXISTS niw_petitions_case_id_fkey;
ALTER TABLE niw_petitions ADD CONSTRAINT niw_petitions_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES visa_cases(id) ON DELETE SET NULL;

-- === Add updated_at triggers to tables that have the column ===

CREATE TRIGGER tr_visa_stages_updated BEFORE UPDATE ON visa_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_visa_deliverables_updated BEFORE UPDATE ON visa_deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_visa_documents_updated BEFORE UPDATE ON visa_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_uscis_submissions_updated BEFORE UPDATE ON uscis_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_user_timelines_updated BEFORE UPDATE ON user_timelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_classic_cases_updated BEFORE UPDATE ON classic_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_book_preparations_updated BEFORE UPDATE ON book_preparations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_book_jobs_updated BEFORE UPDATE ON book_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === Add updated_at to payments (was missing) ===
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE TRIGGER tr_payments_updated BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === Fix client_360 view to prevent duplicate rows per client ===
DROP VIEW IF EXISTS client_360;
CREATE VIEW client_360 AS
SELECT DISTINCT ON (c.id)
  c.id AS client_id,
  c.name,
  c.email,
  c.phone,
  c.visa_type,
  c.user_state,
  c.is_eligible,
  c.created_at AS client_since,
  vc.id AS case_id,
  vc.case_id AS case_number,
  vc.current_stage,
  vc.status AS case_status,
  vc.created_at AS case_created,
  coord.name AS coordinator_name,
  adv.name AS advisor_name,
  (SELECT COUNT(*) FROM payments p WHERE p.client_id = c.id AND p.status = 'completed') AS payments_count,
  (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.client_id = c.id AND p.status = 'completed') AS total_paid,
  (SELECT COUNT(*) FROM patents pat WHERE pat.client_id = c.id) AS patents_count,
  (SELECT COUNT(*) FROM niw_petitions niw WHERE niw.client_id = c.id) AS niw_petitions_count,
  (SELECT COUNT(*) FROM recommendation_letters rl WHERE rl.client_id = c.id) AS recommendation_letters_count,
  (SELECT COUNT(*) FROM econometric_studies es WHERE es.client_id = c.id) AS econometric_studies_count,
  (SELECT COUNT(*) FROM business_plans bp WHERE bp.client_id = c.id) AS business_plans_count,
  (SELECT COUNT(*) FROM generated_documents gd WHERE gd.client_id = c.id) AS other_docs_count
FROM clients c
LEFT JOIN visa_cases vc ON vc.client_id = c.id AND vc.is_master_case = FALSE
LEFT JOIN staff coord ON coord.id = vc.coordinator_id
LEFT JOIN staff adv ON adv.id = vc.advisor_id
ORDER BY c.id, vc.created_at DESC;

-- === Drop redundant indexes (already covered by UNIQUE constraints) ===
DROP INDEX IF EXISTS idx_clients_email;
DROP INDEX IF EXISTS idx_staff_email;
DROP INDEX IF EXISTS idx_magic_links_token;
