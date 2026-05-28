-- 2026-05-27: Client portal publications for NIW documents
--
-- Backs the "publish for client" feature: an operator publishes a generated
-- NIW so the client opens a public link (slug + token, no login) to read the
-- document, comment per section, request changes, approve, or download the PDF.
-- A correction agent then applies comments in up to 2 rounds (1-hour window
-- each, starting from the first comment of the round).
--
-- Follows the mongo_compat pattern: surface columns for fields we filter/index
-- by, plus a `data` JSONB column for everything else (round timers, comment
-- log, etc.). Physical table is prefixed `redactora_`.
--
-- Run once in Supabase Studio (SQL editor). Idempotent.

CREATE TABLE IF NOT EXISTS redactora_portal_publications (
    id            text PRIMARY KEY,
    niw_id        text NOT NULL,                 -- source document id (business_plans / niw_in_progress)
    doc_collection text NOT NULL DEFAULT 'business_plans',
    slug          text NOT NULL UNIQUE,          -- public link segment: /p/{slug}
    token         text NOT NULL,                 -- shared secret, required as query param
    status        text NOT NULL DEFAULT 'draft_published',
    round         integer NOT NULL DEFAULT 0,    -- 0 = none yet, 1 = first round, 2 = last round
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    data          jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Fast lookup by the public slug (the hot path: every client page load).
CREATE INDEX IF NOT EXISTS redactora_portal_pub_slug_idx
    ON redactora_portal_publications (slug);

-- Find the publication(s) for a given source document (admin view, republish).
CREATE INDEX IF NOT EXISTS redactora_portal_pub_niw_idx
    ON redactora_portal_publications (niw_id);

-- The scheduler scans for publications whose correction window has elapsed;
-- indexing status keeps that scan cheap.
CREATE INDEX IF NOT EXISTS redactora_portal_pub_status_idx
    ON redactora_portal_publications (status);

-- Per-section comments left by the client through the public portal.
-- Kept separate from the existing `document_comments` (which is the internal
-- operator commenting system) because portal comments are anonymous-client,
-- tied to a publication + round, and drive the correction agent.
CREATE TABLE IF NOT EXISTS redactora_portal_comments (
    id             text PRIMARY KEY,
    publication_id text NOT NULL,
    niw_id         text NOT NULL,
    round          integer NOT NULL DEFAULT 1,
    kind           text NOT NULL DEFAULT 'section',  -- 'section' | 'global'
    section_id     text,                              -- section slug/number when kind='section'
    lang           text NOT NULL DEFAULT 'en',
    comment        text NOT NULL,
    status         text NOT NULL DEFAULT 'pending',   -- pending | applied
    created_at     timestamptz NOT NULL DEFAULT now(),
    data           jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS redactora_portal_comments_pub_idx
    ON redactora_portal_comments (publication_id);

CREATE INDEX IF NOT EXISTS redactora_portal_comments_pub_round_idx
    ON redactora_portal_comments (publication_id, round);
