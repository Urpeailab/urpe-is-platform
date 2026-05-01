-- Remaining redactora tables (run after 002_test_minimal.sql which created
-- the function and `redactora_users`). Safe to re-run: uses IF NOT EXISTS
-- and DROP TRIGGER IF EXISTS.

-- CLIENTS
CREATE TABLE IF NOT EXISTS redactora_clients (
  id TEXT PRIMARY KEY,
  name TEXT, email TEXT, phone TEXT, company TEXT,
  status TEXT DEFAULT 'active', created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_redactora_clients_email ON redactora_clients(email);
CREATE INDEX IF NOT EXISTS idx_redactora_clients_status ON redactora_clients(status);
DROP TRIGGER IF EXISTS trg_redactora_clients_updated ON redactora_clients;
CREATE TRIGGER trg_redactora_clients_updated BEFORE UPDATE ON redactora_clients
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- BUSINESS PLANS
CREATE TABLE IF NOT EXISTS redactora_business_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, project_title TEXT, applicant_name TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  quality_score NUMERIC, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_plans_user ON redactora_business_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_client ON redactora_business_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_business_plans_status ON redactora_business_plans(status);
DROP TRIGGER IF EXISTS trg_business_plans_updated ON redactora_business_plans;
CREATE TRIGGER trg_business_plans_updated BEFORE UPDATE ON redactora_business_plans
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_business_plans_in_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, project_title TEXT, applicant_name TEXT,
  status TEXT, generation_progress JSONB DEFAULT '{}'::jsonb,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bp_inprog_user ON redactora_business_plans_in_progress(user_id);
DROP TRIGGER IF EXISTS trg_bp_inprog_updated ON redactora_business_plans_in_progress;
CREATE TRIGGER trg_bp_inprog_updated BEFORE UPDATE ON redactora_business_plans_in_progress
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- BOOKS
CREATE TABLE IF NOT EXISTS redactora_books (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, title TEXT, genre TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  current_chapter INTEGER DEFAULT 0, progress_percentage NUMERIC,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_books_user ON redactora_books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_client ON redactora_books(client_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON redactora_books(status);
DROP TRIGGER IF EXISTS trg_books_updated ON redactora_books;
CREATE TRIGGER trg_books_updated BEFORE UPDATE ON redactora_books
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_books_in_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, title TEXT, status TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_books_inprog_updated ON redactora_books_in_progress;
CREATE TRIGGER trg_books_inprog_updated BEFORE UPDATE ON redactora_books_in_progress
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- PATENTS
CREATE TABLE IF NOT EXISTS redactora_patents (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, title TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patents_user ON redactora_patents(user_id);
CREATE INDEX IF NOT EXISTS idx_patents_client ON redactora_patents(client_id);
CREATE INDEX IF NOT EXISTS idx_patents_status ON redactora_patents(status);
DROP TRIGGER IF EXISTS trg_patents_updated ON redactora_patents;
CREATE TRIGGER trg_patents_updated BEFORE UPDATE ON redactora_patents
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_patents_in_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, title TEXT, status TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_patents_inprog_updated ON redactora_patents_in_progress;
CREATE TRIGGER trg_patents_inprog_updated BEFORE UPDATE ON redactora_patents_in_progress
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- WHITEPAPERS
CREATE TABLE IF NOT EXISTS redactora_whitepapers (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, title TEXT, topic TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  current_section INTEGER DEFAULT 0, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whitepapers_user ON redactora_whitepapers(user_id);
CREATE INDEX IF NOT EXISTS idx_whitepapers_status ON redactora_whitepapers(status);
DROP TRIGGER IF EXISTS trg_whitepapers_updated ON redactora_whitepapers;
CREATE TRIGGER trg_whitepapers_updated BEFORE UPDATE ON redactora_whitepapers
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_whitepapers_in_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, title TEXT, status TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_wp_inprog_updated ON redactora_whitepapers_in_progress;
CREATE TRIGGER trg_wp_inprog_updated BEFORE UPDATE ON redactora_whitepapers_in_progress
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- ECONOMETRIC STUDIES
CREATE TABLE IF NOT EXISTS redactora_econometric_studies (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_econ_user ON redactora_econometric_studies(user_id);
CREATE INDEX IF NOT EXISTS idx_econ_client ON redactora_econometric_studies(client_id);
DROP TRIGGER IF EXISTS trg_econ_updated ON redactora_econometric_studies;
CREATE TRIGGER trg_econ_updated BEFORE UPDATE ON redactora_econometric_studies
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_econometric_studies_in_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, status TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_econ_inprog_updated ON redactora_econometric_studies_in_progress;
CREATE TRIGGER trg_econ_inprog_updated BEFORE UPDATE ON redactora_econometric_studies_in_progress
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- CASE STUDIES
CREATE TABLE IF NOT EXISTS redactora_case_studies (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, company_name TEXT, industry TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_case_user ON redactora_case_studies(user_id);
DROP TRIGGER IF EXISTS trg_case_updated ON redactora_case_studies;
CREATE TRIGGER trg_case_updated BEFORE UPDATE ON redactora_case_studies
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- POLICY PAPERS
CREATE TABLE IF NOT EXISTS redactora_policy_papers (
  id TEXT PRIMARY KEY,
  user_id TEXT, title TEXT, topic TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_policy_updated ON redactora_policy_papers;
CREATE TRIGGER trg_policy_updated BEFORE UPDATE ON redactora_policy_papers
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- LETTERS
CREATE TABLE IF NOT EXISTS redactora_expert_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, expert_name TEXT, applicant_name TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_expert_letters_updated ON redactora_expert_letters;
CREATE TRIGGER trg_expert_letters_updated BEFORE UPDATE ON redactora_expert_letters
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_self_petition_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, applicant_name TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_sp_letters_updated ON redactora_self_petition_letters;
CREATE TRIGGER trg_sp_letters_updated BEFORE UPDATE ON redactora_self_petition_letters
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_self_petition_v2_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, applicant_name TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_sp_v2_letters_updated ON redactora_self_petition_v2_letters;
CREATE TRIGGER trg_sp_v2_letters_updated BEFORE UPDATE ON redactora_self_petition_v2_letters
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_self_petition_v2_sessions (
  id TEXT PRIMARY KEY, user_id TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_sp_v2_sess_updated ON redactora_self_petition_v2_sessions;
CREATE TRIGGER trg_sp_v2_sess_updated BEFORE UPDATE ON redactora_self_petition_v2_sessions
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_intent_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_intent_letters_updated ON redactora_intent_letters;
CREATE TRIGGER trg_intent_letters_updated BEFORE UPDATE ON redactora_intent_letters
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_recommendation_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT, client_id TEXT, recommender_name TEXT, applicant_name TEXT,
  language TEXT DEFAULT 'es', status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_rec_letters_updated ON redactora_recommendation_letters;
CREATE TRIGGER trg_rec_letters_updated BEFORE UPDATE ON redactora_recommendation_letters
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- CHAT
CREATE TABLE IF NOT EXISTS redactora_chat_conversations (
  id TEXT PRIMARY KEY, user_id TEXT, conversation_id TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user ON redactora_chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_id ON redactora_chat_conversations(conversation_id);
DROP TRIGGER IF EXISTS trg_chat_conv_updated ON redactora_chat_conversations;
CREATE TRIGGER trg_chat_conv_updated BEFORE UPDATE ON redactora_chat_conversations
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- (chat_messages already exists from previous run — skipping)

-- COMMENTS / VERSIONS
CREATE TABLE IF NOT EXISTS redactora_document_comments (
  id TEXT PRIMARY KEY, document_id TEXT, user_id TEXT,
  comment_text TEXT, resolved BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_doc ON redactora_document_comments(document_id);
DROP TRIGGER IF EXISTS trg_comments_updated ON redactora_document_comments;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON redactora_document_comments
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_document_versions (
  id TEXT PRIMARY KEY, document_id TEXT, document_type TEXT, change_type TEXT,
  user_id TEXT, timestamp TIMESTAMPTZ DEFAULT NOW(),
  previous_content TEXT, new_content TEXT, change_summary TEXT,
  data JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON redactora_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_type ON redactora_document_versions(document_type);

-- LOGS
CREATE TABLE IF NOT EXISTS redactora_activity_logs (
  id TEXT PRIMARY KEY, user_id TEXT, action TEXT,
  resource_type TEXT, resource_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'::jsonb, data JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON redactora_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_ts ON redactora_activity_logs(timestamp);

CREATE TABLE IF NOT EXISTS redactora_auto_recovery_log (
  id TEXT PRIMARY KEY, action_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(), status TEXT,
  data JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS redactora_trash_cleanup_log (
  id TEXT PRIMARY KEY, action_type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(), status TEXT,
  data JSONB DEFAULT '{}'::jsonb
);

-- TRANSLATIONS
CREATE TABLE IF NOT EXISTS redactora_translations (
  id TEXT PRIMARY KEY, user_id TEXT, client_id TEXT,
  source_language TEXT, target_language TEXT,
  status TEXT DEFAULT 'draft', data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_translations_updated ON redactora_translations;
CREATE TRIGGER trg_translations_updated BEFORE UPDATE ON redactora_translations
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_certified_translations (
  id TEXT PRIMARY KEY, user_id TEXT, client_id TEXT,
  source_language TEXT, target_language TEXT,
  status TEXT DEFAULT 'draft', data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_cert_trans_updated ON redactora_certified_translations;
CREATE TRIGGER trg_cert_trans_updated BEFORE UPDATE ON redactora_certified_translations
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_translator_profiles (
  id TEXT PRIMARY KEY, name TEXT,
  status TEXT DEFAULT 'active', data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_translator_updated ON redactora_translator_profiles;
CREATE TRIGGER trg_translator_updated BEFORE UPDATE ON redactora_translator_profiles
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- PROMPTS
CREATE TABLE IF NOT EXISTS redactora_prompt_overrides (
  id TEXT PRIMARY KEY, module_id TEXT, key TEXT, value TEXT,
  override_version INTEGER DEFAULT 1, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prompt_overrides_module ON redactora_prompt_overrides(module_id);
DROP TRIGGER IF EXISTS trg_prompt_overrides_updated ON redactora_prompt_overrides;
CREATE TRIGGER trg_prompt_overrides_updated BEFORE UPDATE ON redactora_prompt_overrides
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_prompt_history (
  id TEXT PRIMARY KEY, module_id TEXT, key TEXT, value TEXT,
  version INTEGER, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prompt_history_module ON redactora_prompt_history(module_id);

-- JOBS
CREATE TABLE IF NOT EXISTS redactora_ai_edit_jobs (
  id TEXT PRIMARY KEY, job_id TEXT UNIQUE, document_id TEXT,
  status TEXT, progress NUMERIC, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_edit_jobs_jobid ON redactora_ai_edit_jobs(job_id);
DROP TRIGGER IF EXISTS trg_ai_edit_jobs_updated ON redactora_ai_edit_jobs;
CREATE TRIGGER trg_ai_edit_jobs_updated BEFORE UPDATE ON redactora_ai_edit_jobs
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_book_ai_edit_jobs (
  id TEXT PRIMARY KEY, job_id TEXT UNIQUE, document_id TEXT,
  status TEXT, progress NUMERIC, data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_book_ai_edit_jobs_jobid ON redactora_book_ai_edit_jobs(job_id);
DROP TRIGGER IF EXISTS trg_book_ai_edit_jobs_updated ON redactora_book_ai_edit_jobs;
CREATE TRIGGER trg_book_ai_edit_jobs_updated BEFORE UPDATE ON redactora_book_ai_edit_jobs
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_extraction_tasks (
  id TEXT PRIMARY KEY, task_type TEXT, status TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_extraction_tasks_updated ON redactora_extraction_tasks;
CREATE TRIGGER trg_extraction_tasks_updated BEFORE UPDATE ON redactora_extraction_tasks
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_suggestion_tasks (
  id TEXT PRIMARY KEY, task_type TEXT, status TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_suggestion_tasks_updated ON redactora_suggestion_tasks;
CREATE TRIGGER trg_suggestion_tasks_updated BEFORE UPDATE ON redactora_suggestion_tasks
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_json_overrides (
  id TEXT PRIMARY KEY, key TEXT, value JSONB,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_json_overrides_updated ON redactora_json_overrides;
CREATE TRIGGER trg_json_overrides_updated BEFORE UPDATE ON redactora_json_overrides
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_json_override_history (
  id TEXT PRIMARY KEY, key TEXT, value JSONB,
  data JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DESIGNED DOCS / EVALUATIONS
CREATE TABLE IF NOT EXISTS redactora_designed_documents (
  id TEXT PRIMARY KEY, document_id TEXT, status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_designed_docs_updated ON redactora_designed_documents;
CREATE TRIGGER trg_designed_docs_updated BEFORE UPDATE ON redactora_designed_documents
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

CREATE TABLE IF NOT EXISTS redactora_patent_evaluations (
  id TEXT PRIMARY KEY, patent_id TEXT, score NUMERIC, feedback TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patent_eval_patent ON redactora_patent_evaluations(patent_id);
DROP TRIGGER IF EXISTS trg_patent_eval_updated ON redactora_patent_evaluations;
CREATE TRIGGER trg_patent_eval_updated BEFORE UPDATE ON redactora_patent_evaluations
  FOR EACH ROW EXECUTE FUNCTION redactora_set_updated_at();

-- Verify
SELECT COUNT(*) AS total_redactora_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'redactora_%';
