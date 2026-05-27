-- 019_visa_print_layouts.sql
-- Módulo "Impresión": arma el archivo maestro de la visa lista para imprimir.
-- Un layout por caso. El árbol de secciones/subsecciones vive en `sections`
-- (JSONB) y es la fuente de verdad del orden y la organización del PDF maestro.
--
-- Estructura de `sections` (JSON, camelCase porque es opaco a Postgres):
--   [
--     {
--       "id": "uuid",
--       "title": {"es": "...", "en": "..."},
--       "order": 0,
--       "includeBranding": true,         -- la separadora de esta sección lleva el logo
--       "items": [
--         {"id":"uuid","deliverableId":"...","fileId":"...","title":"...","order":0}
--       ],
--       "subsections": [
--         {"id":"uuid","title":{"es":"...","en":"..."},"order":0,"items":[...]}
--       ]
--     }
--   ]
--
-- Estructura de `master` (último PDF generado):
--   {"fileUrl":"...","fileName":"...","filePath":"...","pageCount":N,"generatedAt":"..."}

CREATE TABLE IF NOT EXISTS visa_print_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES visa_cases(id) ON DELETE CASCADE,
  branding_image_url TEXT,
  branding_image_path TEXT,
  branding_client_name TEXT,
  branding_address TEXT,
  sections JSONB DEFAULT '[]',
  master JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo layout por caso.
CREATE UNIQUE INDEX IF NOT EXISTS idx_visa_print_layouts_case
  ON visa_print_layouts(case_id);
