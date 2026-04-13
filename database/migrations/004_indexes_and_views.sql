-- ============================================================================
-- 004_indexes_and_views.sql — Indexes de performance + vistas para Data Science
-- ============================================================================

-- === CORE INDEXES ===
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_created ON clients(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_visa_type ON clients(visa_type);
CREATE INDEX IF NOT EXISTS idx_clients_state ON clients(user_state);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_activity_client ON activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);

-- === PORTAL INDEXES ===
CREATE INDEX IF NOT EXISTS idx_visa_cases_client ON visa_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_visa_cases_status ON visa_cases(status);
CREATE INDEX IF NOT EXISTS idx_visa_cases_stage ON visa_cases(current_stage);
CREATE INDEX IF NOT EXISTS idx_visa_cases_created ON visa_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_visa_cases_coordinator ON visa_cases(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_visa_cases_advisor ON visa_cases(advisor_id);
CREATE INDEX IF NOT EXISTS idx_visa_stages_case ON visa_stages(case_id);
CREATE INDEX IF NOT EXISTS idx_visa_stages_number ON visa_stages(case_id, stage_number);
CREATE INDEX IF NOT EXISTS idx_visa_documents_case ON visa_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_visa_deliverables_case ON visa_deliverables(case_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_case ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_uscis_sub_client ON uscis_submissions(client_id);
CREATE INDEX IF NOT EXISTS idx_uscis_sub_case ON uscis_submissions(case_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_case_notes_case ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_case_audit_case ON case_audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_book_preps_case ON book_preparations(case_id);

-- === REDACTORA INDEXES ===
CREATE INDEX IF NOT EXISTS idx_patents_client ON patents(client_id);
CREATE INDEX IF NOT EXISTS idx_patents_status ON patents(patent_status);
CREATE INDEX IF NOT EXISTS idx_patent_drafts_patent ON patent_drafts(patent_id);
CREATE INDEX IF NOT EXISTS idx_niw_client ON niw_petitions(client_id);
CREATE INDEX IF NOT EXISTS idx_niw_case ON niw_petitions(case_id);
CREATE INDEX IF NOT EXISTS idx_niw_status ON niw_petitions(status);
CREATE INDEX IF NOT EXISTS idx_rec_letters_client ON recommendation_letters(client_id);
CREATE INDEX IF NOT EXISTS idx_econometric_client ON econometric_studies(client_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_client ON business_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_client ON generated_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_type ON generated_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_redactora_chat_client ON redactora_chat_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_redactora_chat_conv ON redactora_chat_messages(conversation_id);

-- === VISTAS PARA DATA SCIENCE ===

-- Vista 360 del cliente: caso + pagos + documentos generados
CREATE OR REPLACE VIEW client_360 AS
SELECT
  c.id AS client_id,
  c.name,
  c.email,
  c.phone,
  c.visa_type,
  c.user_state,
  c.is_eligible,
  c.created_at AS client_since,
  -- Caso
  vc.id AS case_id,
  vc.case_id AS case_number,
  vc.current_stage,
  vc.status AS case_status,
  vc.created_at AS case_created,
  -- Staff asignado
  coord.name AS coordinator_name,
  adv.name AS advisor_name,
  -- Pagos
  (SELECT COUNT(*) FROM payments p WHERE p.client_id = c.id AND p.status = 'completed') AS payments_count,
  (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.client_id = c.id AND p.status = 'completed') AS total_paid,
  -- Documentos legales generados
  (SELECT COUNT(*) FROM patents pat WHERE pat.client_id = c.id) AS patents_count,
  (SELECT COUNT(*) FROM niw_petitions niw WHERE niw.client_id = c.id) AS niw_petitions_count,
  (SELECT COUNT(*) FROM recommendation_letters rl WHERE rl.client_id = c.id) AS recommendation_letters_count,
  (SELECT COUNT(*) FROM econometric_studies es WHERE es.client_id = c.id) AS econometric_studies_count,
  (SELECT COUNT(*) FROM business_plans bp WHERE bp.client_id = c.id) AS business_plans_count,
  (SELECT COUNT(*) FROM generated_documents gd WHERE gd.client_id = c.id) AS other_docs_count
FROM clients c
LEFT JOIN visa_cases vc ON vc.client_id = c.id AND vc.is_master_case = FALSE
LEFT JOIN staff coord ON coord.id = vc.coordinator_id
LEFT JOIN staff adv ON adv.id = vc.advisor_id;

-- Vista de revenue por mes
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  DATE_TRUNC('month', paid_at) AS month,
  COUNT(*) AS payment_count,
  COUNT(DISTINCT client_id) AS unique_clients,
  SUM(amount) AS total_revenue,
  AVG(amount) AS avg_ticket,
  MIN(amount) AS min_payment,
  MAX(amount) AS max_payment
FROM payments
WHERE status = 'completed' AND paid_at IS NOT NULL
GROUP BY DATE_TRUNC('month', paid_at)
ORDER BY month DESC;

-- Vista de pipeline (funnel de conversion)
CREATE OR REPLACE VIEW conversion_funnel AS
SELECT
  'leads' AS stage,
  COUNT(*) AS count
FROM leads
UNION ALL
SELECT
  'eligible_clients',
  COUNT(*)
FROM clients WHERE is_eligible = TRUE
UNION ALL
SELECT
  'active_cases',
  COUNT(*)
FROM visa_cases WHERE status IN ('en_proceso', 'proceso_venta') AND is_master_case = FALSE
UNION ALL
SELECT
  'stage_3_plus',
  COUNT(*)
FROM visa_cases WHERE current_stage >= 3 AND is_master_case = FALSE
UNION ALL
SELECT
  'completed_cases',
  COUNT(*)
FROM visa_cases WHERE status = 'completed' AND is_master_case = FALSE;

-- Vista de productividad de documentos por cliente
CREATE OR REPLACE VIEW client_document_completeness AS
SELECT
  c.id AS client_id,
  c.name,
  vc.current_stage,
  CASE WHEN EXISTS (SELECT 1 FROM patents p WHERE p.client_id = c.id AND p.patent_status = 'completed') THEN TRUE ELSE FALSE END AS has_patent,
  CASE WHEN EXISTS (SELECT 1 FROM niw_petitions n WHERE n.client_id = c.id AND n.status = 'completed') THEN TRUE ELSE FALSE END AS has_niw,
  CASE WHEN EXISTS (SELECT 1 FROM recommendation_letters r WHERE r.client_id = c.id AND r.status IN ('completed', 'approved')) THEN TRUE ELSE FALSE END AS has_rec_letter,
  CASE WHEN EXISTS (SELECT 1 FROM econometric_studies e WHERE e.client_id = c.id AND e.status = 'completed') THEN TRUE ELSE FALSE END AS has_econometric,
  CASE WHEN EXISTS (SELECT 1 FROM business_plans b WHERE b.client_id = c.id AND b.status = 'completed') THEN TRUE ELSE FALSE END AS has_business_plan
FROM clients c
LEFT JOIN visa_cases vc ON vc.client_id = c.id AND vc.is_master_case = FALSE
WHERE c.user_state = 'U3';

-- Vista de staff performance
CREATE OR REPLACE VIEW staff_performance AS
SELECT
  s.id AS staff_id,
  s.name,
  s.role,
  (SELECT COUNT(*) FROM visa_cases vc WHERE vc.coordinator_id = s.id AND vc.is_master_case = FALSE) AS cases_as_coordinator,
  (SELECT COUNT(*) FROM visa_cases vc WHERE vc.advisor_id = s.id AND vc.is_master_case = FALSE) AS cases_as_advisor,
  (SELECT COUNT(*) FROM visa_cases vc WHERE (vc.coordinator_id = s.id OR vc.advisor_id = s.id) AND vc.status = 'completed' AND vc.is_master_case = FALSE) AS completed_cases,
  (SELECT COUNT(*) FROM case_notes cn WHERE cn.staff_id = s.id) AS notes_written,
  (SELECT COUNT(*) FROM appointments a WHERE a.staff_id = s.id AND a.status = 'completed') AS appointments_completed
FROM staff s
WHERE s.is_active = TRUE;
