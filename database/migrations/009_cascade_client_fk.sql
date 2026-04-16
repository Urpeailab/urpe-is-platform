-- Fix all client_id FK constraints to ON DELETE CASCADE
-- Tables not covered by 005_fixes.sql

-- Portal tables
ALTER TABLE visa_cases DROP CONSTRAINT IF EXISTS visa_cases_client_id_fkey;
ALTER TABLE visa_cases ADD CONSTRAINT visa_cases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE user_timelines DROP CONSTRAINT IF EXISTS user_timelines_client_id_fkey;
ALTER TABLE user_timelines ADD CONSTRAINT user_timelines_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_client_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE classic_cases DROP CONSTRAINT IF EXISTS classic_cases_client_id_fkey;
ALTER TABLE classic_cases ADD CONSTRAINT classic_cases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- Redactora tables
ALTER TABLE patents DROP CONSTRAINT IF EXISTS patents_client_id_fkey;
ALTER TABLE patents ADD CONSTRAINT patents_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE niw_petitions DROP CONSTRAINT IF EXISTS niw_petitions_client_id_fkey;
ALTER TABLE niw_petitions ADD CONSTRAINT niw_petitions_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE recommendation_letters DROP CONSTRAINT IF EXISTS recommendation_letters_client_id_fkey;
ALTER TABLE recommendation_letters ADD CONSTRAINT recommendation_letters_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE econometric_studies DROP CONSTRAINT IF EXISTS econometric_studies_client_id_fkey;
ALTER TABLE econometric_studies ADD CONSTRAINT econometric_studies_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE business_plans DROP CONSTRAINT IF EXISTS business_plans_client_id_fkey;
ALTER TABLE business_plans ADD CONSTRAINT business_plans_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE generated_documents DROP CONSTRAINT IF EXISTS generated_documents_client_id_fkey;
ALTER TABLE generated_documents ADD CONSTRAINT generated_documents_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE redactora_chat_messages DROP CONSTRAINT IF EXISTS redactora_chat_messages_client_id_fkey;
ALTER TABLE redactora_chat_messages ADD CONSTRAINT redactora_chat_messages_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
