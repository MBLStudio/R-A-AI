-- ============================================
-- R&A — Módulo "Sorpresa" (carta única de Alejandro para Rut)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS sorpresa (
  id            TEXT PRIMARY KEY DEFAULT 'principal',
  titulo        TEXT NOT NULL DEFAULT '',
  cuerpo        TEXT NOT NULL DEFAULT '',
  firma_nombre  TEXT NOT NULL DEFAULT '',
  firma_url     TEXT,
  firma_at      TIMESTAMPTZ,
  fotos         TEXT[] NOT NULL DEFAULT '{}',   -- fotos del tatuaje (el reverso)
  foto_caption  TEXT NOT NULL DEFAULT '',
  revelada      BOOLEAN NOT NULL DEFAULT FALSE,
  revelada_at   TIMESTAMPTZ,
  abierta_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fila única inicial (el texto se precarga en el editor; Alejandro revisa y guarda)
INSERT INTO sorpresa (id) VALUES ('principal') ON CONFLICT DO NOTHING;

-- Sin auth en la app → RLS desactivado (igual que el resto de tablas)
ALTER TABLE sorpresa DISABLE ROW LEVEL SECURITY;

-- Si ya habías creado la tabla con la versión anterior (foto_url), migra así:
--   ALTER TABLE sorpresa ADD COLUMN IF NOT EXISTS fotos TEXT[] NOT NULL DEFAULT '{}';
--   UPDATE sorpresa SET fotos = ARRAY[foto_url] WHERE foto_url IS NOT NULL AND fotos = '{}';
--   ALTER TABLE sorpresa DROP COLUMN IF EXISTS foto_url;
