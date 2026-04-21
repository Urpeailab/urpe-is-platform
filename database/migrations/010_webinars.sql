-- Webinars table
CREATE TABLE IF NOT EXISTS webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB,                                -- {"es": "...", "en": "..."}
  description JSONB,                          -- {"es": "...", "en": "..."}
  type TEXT DEFAULT 'live',                   -- live, recorded, upcoming
  date TEXT,                                  -- fecha del webinar
  time TEXT,                                  -- hora del webinar
  duration INT DEFAULT 60,                    -- duración en minutos
  capacity INT DEFAULT 100,
  video_url TEXT,
  meeting_link TEXT,
  thumbnail TEXT,
  presenter JSONB,                            -- {"name": "...", "title": "...", "avatar": "..."}
  level TEXT DEFAULT 'intermediate',          -- beginner, intermediate, advanced
  topics TEXT[] DEFAULT '{}',
  language TEXT DEFAULT 'both',               -- es, en, both
  registered_count INT DEFAULT 0,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER tr_webinars_updated BEFORE UPDATE ON webinars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
