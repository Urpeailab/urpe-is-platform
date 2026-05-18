# MongoDB Inventory — apps/redactora/backend/server.py

Generated as part of the Mongo→Supabase migration (Session 1).

## Summary

- **Total collections**: 42 (33 main + 9 in-progress mirrors)
- **Total Mongo call sites in server.py**: ~185
- **server.py size**: 43,446 lines
- **Transactions/sessions**: NOT used (good)
- **GridFS**: NOT used (good)
- **Aggregation pipelines**: present in 3 places (`document_versions`, `business_plans`, `prompt_history`)
- **Primary keys**: custom string UUIDs in `id` field (NOT Mongo `_id`) — easy to migrate

## Operators in use

**Update**: `$set`, `$push`, `$pull`, `$unset`, `$inc`, `$addToSet`
**Query**: `$ne`, `$exists`, `$or`, `$in`, `$nin`, `$eq`, `$gt`, `$lt`, `$gte`, `$lte`, `$regex`
**Aggregation**: `$match`, `$group`, `$sum`, `$cond`, `$avg`, `$sort`

## Collections

| # | Collection | Operations | Key fields | Notes |
|---|---|---|---|---|
| 1 | `users` | find_one, find, insert_one, update_one, count | id, email, full_name, role, status, language_preference, permissions, password, created_at, deleted_at | Soft-delete via status |
| 2 | `clients` | CRUD + count | id, name, email, phone, company, status, created_at, created_by | |
| 3 | `business_plans` (NIW) | CRUD + aggregate | id, user_id, client_id, project_title, applicant_name, sections[], language, status, quality_score, content_es, content_en | Big — sections as JSONB |
| 4 | `business_plans_in_progress` | CRUD | id, user_id, client_id, generation_progress, status | Mirror of business_plans |
| 5 | `books` | CRUD + aggregate | id, user_id, client_id, title, genre, chapters[], current_chapter, status, progress_percentage | Chapters as JSONB |
| 6 | `books_in_progress` | CRUD | (mirror) | |
| 7 | `patents` | CRUD | id, user_id, client_id, title, abstract, claims, specifications, language, status | |
| 8 | `patents_in_progress` | CRUD | (mirror) | |
| 9 | `whitepapers` | CRUD | id, user_id, title, topic, sections[], current_section, status | |
| 10 | `whitepapers_in_progress` | CRUD | (mirror) | |
| 11 | `econometric_studies` | CRUD | id, user_id, client_id, project_description, sections, status | |
| 12 | `econometric_studies_in_progress` | CRUD | (mirror) | |
| 13 | `case_studies` | CRUD | id, user_id, client_id, company_name, industry, challenge, solution, sections[] | |
| 14 | `policy_papers` | CRUD | id, user_id, title, topic, sections[], status | |
| 15 | `expert_letters` | CRUD | id, user_id, expert_name, expert_credentials, applicant_name, content, status | |
| 16 | `self_petition_letters` | CRUD | id, user_id, client_id, applicant_name, content, status | |
| 17 | `self_petition_v2_letters` | CRUD | (similar to above) | |
| 18 | `self_petition_v2_sessions` | CRUD | id, user_id, session_data | |
| 19 | `intent_letters` | CRUD | id, user_id, client_id, content, status | |
| 20 | `recommendation_letters` | CRUD | id, user_id, client_id, recommender_name, applicant_name, content | |
| 21 | `chat_conversations` | CRUD | id, user_id, conversation_id, created_at | |
| 22 | `chat_messages` | CRUD | id, conversation_id, role, content, timestamp | |
| 23 | `document_comments` | CRUD + count | id, document_id, user_id, comment_text, resolved | |
| 24 | `document_versions` | find + aggregate | id, document_id, document_type, change_type, user_id, previous_content, new_content | Aggregation: $match+$group |
| 25 | `activity_logs` | insert (one/many) + find | id, user_id, action, resource_type, resource_id, timestamp, details | Append-only |
| 26 | `auto_recovery_log` | insert + find | id, action_type, timestamp, status | Append-only |
| 27 | `trash_cleanup_log` | insert + find | (similar) | Append-only |
| 28 | `translations` | CRUD | id, user_id, source_text, target_text, source_language, target_language, status | |
| 29 | `certified_translations` | CRUD | (similar) | |
| 30 | `translator_profiles` | CRUD | id, name, languages, status | |
| 31 | `prompt_overrides` | CRUD + aggregate | id, module_id, key, value, override_version | |
| 32 | `prompt_history` | CRUD + aggregate | id, module_id, key, value, version | |
| 33 | `ai_edit_jobs` | CRUD | id, job_id, document_id, status, progress | |
| 34 | `book_ai_edit_jobs` | CRUD | (similar) | |
| 35 | `extraction_tasks` | CRUD | id, task_type, input_data, output_data, status | |
| 36 | `suggestion_tasks` | CRUD | (similar) | |
| 37 | `json_overrides` | CRUD | id, key, value | |
| 38 | `json_override_history` | CRUD | (similar) | |
| 39 | `designed_documents` | CRUD | id, document_id, design_data, status | |
| 40 | `patent_evaluations` | CRUD | id, patent_id, score, feedback | |

## Migration strategy

- Use **JSONB** columns for nested arrays (sections, chapters, edit_history) initially — fastest path. Normalize later if needed.
- Keep `id` as TEXT primary key (compatible with current str(uuid.uuid4())).
- Add indexes on `user_id`, `client_id`, `status`.
- Soft-delete pattern: keep `status` column, allow value `"deleted"`, plus `deleted_at` timestamp.
- The 9 `_in_progress` mirror collections can be merged into the main table by adding a `progress_state` column (or kept separate for simplicity).
