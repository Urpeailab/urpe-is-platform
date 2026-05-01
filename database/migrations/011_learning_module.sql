-- ============================================================================
-- 011_learning_module.sql — Modulo de Aprendizaje con Avatar HeyGen + RAG
-- URPE Integral Services Platform
-- ============================================================================
--
-- Habilita pgvector y crea las tablas necesarias para:
--   - Modulos de aprendizaje (playlists con system_prompt y modo guiado/libre)
--   - Documentos subidos (PDF/DOCX) y sus chunks vectorizados
--   - Sesiones de conversacion staff <-> avatar HeyGen
--   - Mensajes (transcripcion completa) y evaluaciones de modo guiado
--
-- Storage: el bucket "learning-documents" (privado) debe crearse desde el
-- dashboard de Supabase o via el cliente de Storage al iniciar el backend.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ====================== Modulos ======================
CREATE TABLE IF NOT EXISTS learning_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,                       -- prompt base del avatar para este modulo
  mode TEXT NOT NULL DEFAULT 'free',                 -- 'guided' | 'free'
  objectives JSONB DEFAULT '[]'::jsonb,              -- [{"id":"obj1","text":"..."}]  (modo guiado)
  llm_model TEXT DEFAULT 'openai/gpt-4o-mini',       -- modelo OpenRouter por modulo
  status TEXT NOT NULL DEFAULT 'draft',              -- 'draft' | 'published' | 'archived'
  order_index INT DEFAULT 0,
  created_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_modules_status ON learning_modules(status);
CREATE INDEX IF NOT EXISTS idx_learning_modules_order ON learning_modules(order_index);

DROP TRIGGER IF EXISTS tr_learning_modules_updated ON learning_modules;
CREATE TRIGGER tr_learning_modules_updated BEFORE UPDATE ON learning_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================== Documentos ======================
CREATE TABLE IF NOT EXISTS learning_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES learning_modules(id) ON DELETE SET NULL,  -- NULL = RAG global
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,                        -- ruta dentro del bucket
  mime_type TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',            -- 'pending' | 'processing' | 'indexed' | 'failed'
  error_message TEXT,
  chunk_count INT DEFAULT 0,
  uploaded_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_documents_module ON learning_documents(module_id);
CREATE INDEX IF NOT EXISTS idx_learning_documents_status ON learning_documents(status);

DROP TRIGGER IF EXISTS tr_learning_documents_updated ON learning_documents;
CREATE TRIGGER tr_learning_documents_updated BEFORE UPDATE ON learning_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================== Chunks (RAG) ======================
-- 1536 dims = OpenAI text-embedding-3-small
CREATE TABLE IF NOT EXISTS learning_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES learning_documents(id) ON DELETE CASCADE,
  module_id UUID REFERENCES learning_modules(id) ON DELETE SET NULL,  -- denormalizado para filtros rapidos
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,                -- {page, section, source_filename}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_chunks_document ON learning_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_learning_chunks_module ON learning_chunks(module_id);

-- Indice vectorial para busqueda por similitud (cosine).
-- ivfflat requiere ANALYZE despues de cargar datos para mejor rendimiento.
-- lists=100 es razonable hasta ~100k chunks; ajustar si crece mucho.
CREATE INDEX IF NOT EXISTS idx_learning_chunks_embedding
  ON learning_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ====================== Sesiones ======================
CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id),
  module_id UUID REFERENCES learning_modules(id) ON DELETE SET NULL,  -- NULL = conversacion libre
  status TEXT NOT NULL DEFAULT 'active',             -- 'active' | 'completed' | 'abandoned'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  summary TEXT,                                       -- resumen generado al cerrar
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_staff ON learning_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_module ON learning_sessions(module_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_status ON learning_sessions(status);

DROP TRIGGER IF EXISTS tr_learning_sessions_updated ON learning_sessions;
CREATE TRIGGER tr_learning_sessions_updated BEFORE UPDATE ON learning_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================== Mensajes (transcripcion) ======================
CREATE TABLE IF NOT EXISTS learning_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                                 -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  retrieved_chunk_ids JSONB DEFAULT '[]'::jsonb,     -- ids de chunks usados para esta respuesta
  tokens_input INT,
  tokens_output INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_messages_session ON learning_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_messages_created ON learning_messages(created_at);

-- ====================== Evaluaciones (modo guiado) ======================
CREATE TABLE IF NOT EXISTS learning_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  module_id UUID REFERENCES learning_modules(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id),
  score NUMERIC(5,2),                                 -- 0..100
  objectives_covered JSONB DEFAULT '[]'::jsonb,       -- [{"id":"obj1","covered":true,"evidence":"..."}]
  feedback TEXT,
  raw_response JSONB,                                 -- respuesta completa del LLM evaluador
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_evaluations_session ON learning_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_evaluations_module ON learning_evaluations(module_id);
CREATE INDEX IF NOT EXISTS idx_learning_evaluations_staff ON learning_evaluations(staff_id);

-- ====================== Funcion RPC para busqueda semantica ======================
-- Uso desde el backend: supabase.rpc('match_learning_chunks', { query_embedding, match_count, filter_module_id })
CREATE OR REPLACE FUNCTION match_learning_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_module_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  module_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.module_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM learning_chunks c
  WHERE c.embedding IS NOT NULL
    AND (filter_module_id IS NULL OR c.module_id = filter_module_id OR c.module_id IS NULL)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
