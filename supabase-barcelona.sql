-- ============================================================
-- R&A — Proyecto Barcelona 🇪🇸
-- "Catalanes por una temporada"
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ETAPAS — cada capítulo de vuestra historia
-- Barcelona 2026 es la primera. El año que viene puede haber otra.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_etapas (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre         TEXT NOT NULL,
  ciudad         TEXT NOT NULL DEFAULT 'Barcelona',
  subtitulo      TEXT,
  fecha_llegada  DATE,
  fecha_mudanza  DATE,
  activa         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- BARRIOS — no son barrios, son posibilidades de vida
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_barrios (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id    UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  color       TEXT,          -- color en el mapa ilustrado
  visitado    BOOLEAN DEFAULT false,
  orden       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MOMENTOS — el corazón de todo
-- Una sola tabla alimenta tres vistas:
--   Agenda       → estado = 'previsto'
--   Historia     → estado = 'vivido'  (línea temporal)
--   Experiencias → estado = 'vivido' AND tipo IN (restaurante, rooftop, excursion…)
-- Guardas una vez, aparece donde toca.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_momentos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id    UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  hora        TIME,
  estado      TEXT NOT NULL DEFAULT 'previsto',  -- 'previsto' | 'vivido'
  tipo        TEXT NOT NULL DEFAULT 'otro',
  -- tipos: llegada, visita_piso, cita, restaurante, rooftop, playa,
  --        excursion, explorar, mudanza, otro
  titulo      TEXT NOT NULL,
  nota        TEXT,
  fotos       TEXT[] DEFAULT '{}',
  lugar       TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  barrio_id   UUID REFERENCES bcn_barrios(id) ON DELETE SET NULL,
  piso_id     UUID,                              -- FK añadida más abajo
  autor       TEXT DEFAULT 'ambos',              -- 'alejandro' | 'rut' | 'ambos'
  es_hito     BOOLEAN DEFAULT false,             -- llegada, entrevista, mudanza…
  espontaneo  BOOLEAN DEFAULT false,             -- botón "Guardar momento"
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PISOS — cada piso es una decisión, no un anuncio
-- datos_extra (jsonb) queda abierto para lo que traiga
-- la extensión de Chrome de Idealista / Fotocasa
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_pisos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id     UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  url          TEXT,
  portal       TEXT,          -- 'idealista' | 'fotocasa' | 'habitaclia' | 'manual'
  portal_id    TEXT,          -- id del anuncio, para no duplicar
  precio       NUMERIC,
  gastos       NUMERIC,
  m2           INTEGER,
  habitaciones INTEGER,
  banos        INTEGER,
  planta       TEXT,
  ascensor     BOOLEAN,
  amueblado    BOOLEAN,
  exterior     BOOLEAN,
  direccion    TEXT,
  barrio_id    UUID REFERENCES bcn_barrios(id) ON DELETE SET NULL,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  fotos        TEXT[] DEFAULT '{}',
  descripcion  TEXT,
  estado       TEXT DEFAULT 'nuevo',
  -- estados: nuevo, contactado, visitado, favorito, descartado, elegido
  motivo_descarte TEXT,
  datos_extra  JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bcn_momentos
  DROP CONSTRAINT IF EXISTS bcn_momentos_piso_id_fkey;
ALTER TABLE bcn_momentos
  ADD CONSTRAINT bcn_momentos_piso_id_fkey
  FOREIGN KEY (piso_id) REFERENCES bcn_pisos(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- VALORACIONES — el motor de Compatibilidad R&A
-- Una sola tabla para barrios, pisos y experiencias.
-- 4 ejes numéricos (1-10) + nota libre que lee la IA.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_valoraciones (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id     UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  entidad_tipo TEXT NOT NULL,   -- 'barrio' | 'piso' | 'experiencia'
  entidad_id   UUID NOT NULL,
  usuario      TEXT NOT NULL,   -- 'alejandro' | 'rut'
  transporte   INTEGER CHECK (transporte BETWEEN 1 AND 10),
  ambiente     INTEGER CHECK (ambiente   BETWEEN 1 AND 10),
  precio       INTEGER CHECK (precio     BETWEEN 1 AND 10),
  sensacion    INTEGER CHECK (sensacion  BETWEEN 1 AND 10),
  nota         TEXT,            -- texto libre, lo lee la IA
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entidad_tipo, entidad_id, usuario)
);

-- ─────────────────────────────────────────────────────────────
-- CONTACTOS — meses después siguen estando ahí
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_contactos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id   UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  tipo       TEXT DEFAULT 'otro',
  -- tipos: inmobiliaria, propietario, empresa, amigo, conocido, otro
  empresa    TEXT,
  telefono   TEXT,
  email      TEXT,
  notas      TEXT,
  favorito   BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CACHÉ DE IA — para no quemar la API key en cada carga
-- datos_hash detecta si hay contenido nuevo que justifique regenerar
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_ia (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id   UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,
  -- tipos: resumen_hub, resumen_semanal, narrativa, analisis_barrio, analisis_piso
  clave      TEXT NOT NULL,   -- 'hub' | 'semana-2026-W32' | 'barrio-<uuid>' …
  contenido  TEXT NOT NULL,
  datos_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (etapa_id, tipo, clave)
);

-- ─────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS bcn_momentos_etapa_fecha_idx  ON bcn_momentos(etapa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS bcn_momentos_estado_idx       ON bcn_momentos(etapa_id, estado, fecha);
CREATE INDEX IF NOT EXISTS bcn_momentos_barrio_idx       ON bcn_momentos(barrio_id);
CREATE INDEX IF NOT EXISTS bcn_pisos_etapa_idx           ON bcn_pisos(etapa_id, estado);
CREATE INDEX IF NOT EXISTS bcn_pisos_portal_idx          ON bcn_pisos(portal, portal_id);
CREATE INDEX IF NOT EXISTS bcn_valoraciones_entidad_idx  ON bcn_valoraciones(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS bcn_barrios_etapa_idx         ON bcn_barrios(etapa_id, orden);
CREATE INDEX IF NOT EXISTS bcn_contactos_etapa_idx       ON bcn_contactos(etapa_id);

-- ─────────────────────────────────────────────────────────────
-- RLS desactivado — coherente con el resto de la app (no hay auth)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bcn_etapas       DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_barrios      DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_momentos     DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_pisos        DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_valoraciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_contactos    DISABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_ia           DISABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════
-- SEMILLA — Barcelona 2026
-- ═════════════════════════════════════════════════════════════
INSERT INTO bcn_etapas (nombre, ciudad, subtitulo, fecha_llegada, fecha_mudanza, activa)
SELECT 'Barcelona 2026', 'Barcelona', 'Catalanes por una temporada', '2026-08-08', '2026-10-05', true
WHERE NOT EXISTS (SELECT 1 FROM bcn_etapas WHERE nombre = 'Barcelona 2026');

-- Barrios con coordenadas reales y su color en el mapa ilustrado
INSERT INTO bcn_barrios (etapa_id, nombre, descripcion, lat, lng, color, orden)
SELECT e.id, b.nombre, b.descripcion, b.lat, b.lng, b.color, b.orden
FROM bcn_etapas e
CROSS JOIN (VALUES
  ('Sant Antoni',  'Mercado, terrazas y vida de barrio a un paso del centro', 41.3785, 2.1580, '#C1502E', 1),
  ('Gràcia',       'Plazas, ambiente independiente y aire de pueblo dentro de la ciudad', 41.4030, 2.1560, '#E8A33D', 2),
  ('Eixample',     'Las manzanas de Cerdà, modernismo y todo bien comunicado', 41.3925, 2.1650, '#6B8F71', 3),
  ('El Born',      'Callejones medievales, tiendas pequeñas y el Parc de la Ciutadella', 41.3850, 2.1830, '#A0527A', 4),
  ('Gòtic',        'El corazón histórico — bello y turístico a partes iguales', 41.3830, 2.1770, '#8C6D4F', 5),
  ('Poble-sec',    'Bajo Montjuïc, tapas en Blai y precios más amables', 41.3730, 2.1620, '#4E8098', 6),
  ('Poblenou',     'La Rambla del Poblenou, playa cerca y ambiente tranquilo', 41.4000, 2.2020, '#3F9C8F', 7),
  ('Sants',        'Auténtico, bien conectado y de los más asequibles', 41.3750, 2.1330, '#7A6FA8', 8),
  ('El Raval',     'Multicultural, vivo y con mucho carácter', 41.3800, 2.1690, '#B8574B', 9),
  ('Barceloneta',  'El mar a la puerta de casa, con todo lo que eso implica', 41.3800, 2.1900, '#2E86AB', 10),
  ('Les Corts',    'Residencial, tranquilo y familiar', 41.3870, 2.1300, '#5F8A5F', 11),
  ('Sarrià',       'Verde, señorial y silencioso — la Barcelona más calmada', 41.3990, 2.1220, '#87A96B', 12)
) AS b(nombre, descripcion, lat, lng, color, orden)
WHERE e.nombre = 'Barcelona 2026'
  AND NOT EXISTS (SELECT 1 FROM bcn_barrios WHERE etapa_id = e.id);

-- Primer hito: la llegada
INSERT INTO bcn_momentos (etapa_id, fecha, estado, tipo, titulo, nota, es_hito, autor)
SELECT e.id, '2026-08-08', 'previsto', 'llegada',
       'Llegamos a Barcelona',
       'El principio de todo.', true, 'ambos'
FROM bcn_etapas e
WHERE e.nombre = 'Barcelona 2026'
  AND NOT EXISTS (SELECT 1 FROM bcn_momentos WHERE etapa_id = e.id AND tipo = 'llegada');
