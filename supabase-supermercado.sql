-- ============================================================
-- R&A · Proyecto Barcelona — SUPERMERCADO
--
-- Todo gira alrededor del RECETARIO:
--
--   · super_recetas → las recetas de los dos, con sus ingredientes
--                     por ración, pasos y vuestra nota (❤️ 👍 👎).
--   · super_plan    → el menú: comida y cena de cada día. Cada
--                     hueco apunta a una receta o lleva un texto
--                     libre ("Fuera", "Sobras").
--   · super_lista   → la lista de la compra, con su tick.
--   · super_nevera  → lo que hay en casa. Se llena sola al dar
--                     una compra por hecha.
--   · super_compras → el historial de compras hechas.
--   · super_perfiles→ edad, altura, peso y actividad de cada uno,
--                     para calcular lo que necesita comer.
--
-- Los valores nutricionales son POR RACIÓN y aproximados.
--
-- Ejecutar una vez en el editor SQL de Supabase. Es idempotente.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- RECETAS
-- ingredientes = [{"nombre":"Garbanzos cocidos","cantidad":400,"unidad":"g","seccion":"despensa"}]
--   (cantidades para `raciones` personas; cantidad 0 = "al gusto")
-- pasos = ["Sofríe la cebolla…", "…"]
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_recetas (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre           TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  descripcion      TEXT,
  raciones         INTEGER NOT NULL DEFAULT 2 CHECK (raciones BETWEEN 1 AND 20),
  tiempo_min       INTEGER CHECK (tiempo_min IS NULL OR tiempo_min BETWEEN 1 AND 600),
  dificultad       TEXT CHECK (dificultad IS NULL OR dificultad IN ('facil', 'media', 'elaborada')),
  kcal_racion      INTEGER,
  proteinas_racion INTEGER,
  hidratos_racion  INTEGER,
  grasas_racion    INTEGER,
  fibra_racion     INTEGER,
  ingredientes     JSONB NOT NULL DEFAULT '[]'::jsonb,
  pasos            JSONB NOT NULL DEFAULT '[]'::jsonb,
  etiquetas        TEXT[] NOT NULL DEFAULT '{}',
  origen           TEXT NOT NULL DEFAULT 'ia' CHECK (origen IN ('ia', 'nuestra', 'enlace')),
  enlace           TEXT,
  foto_url         TEXT,
  valoracion       TEXT CHECK (valoracion IS NULL OR valoracion IN ('encanta', 'bien', 'nunca')),
  nota             TEXT,
  veces            INTEGER NOT NULL DEFAULT 0,
  ultima_vez       DATE,
  fijo             BOOLEAN NOT NULL DEFAULT false,   -- de los vuestros: que salga a menudo
  dia_fijo         SMALLINT CHECK (dia_fijo IS NULL OR dia_fijo BETWEEN 1 AND 7),  -- 1 = lunes
  creada_por       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MENÚ — un hueco por día y momento
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_plan (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha      DATE NOT NULL,
  momento    TEXT NOT NULL CHECK (momento IN ('comida', 'cena')),
  receta_id  UUID REFERENCES super_recetas(id) ON DELETE SET NULL,
  texto      TEXT,
  raciones   INTEGER NOT NULL DEFAULT 2 CHECK (raciones BETWEEN 1 AND 20),
  hecho      BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fecha, momento)
);

-- ─────────────────────────────────────────────────────────────
-- LISTA DE LA COMPRA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_lista (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  cantidad    TEXT,
  seccion     TEXT NOT NULL DEFAULT 'otros',
  comprado    BOOLEAN NOT NULL DEFAULT false,
  origen      TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'menu', 'receta')),
  anadido_por TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- NEVERA Y DESPENSA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_nevera (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  cantidad   TEXT,
  seccion    TEXT NOT NULL DEFAULT 'otros',
  caduca     DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- HISTORIAL DE COMPRAS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_compras (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  productos  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- PERFILES — para calcular calorías y macros de cada uno
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_perfiles (
  persona    TEXT PRIMARY KEY CHECK (persona IN ('alejandro', 'rut')),
  sexo       TEXT NOT NULL CHECK (sexo IN ('h', 'm')),
  edad       INTEGER NOT NULL CHECK (edad BETWEEN 14 AND 100),
  altura_cm  INTEGER NOT NULL CHECK (altura_cm BETWEEN 120 AND 230),
  peso_kg    NUMERIC(5,1) NOT NULL CHECK (peso_kg BETWEEN 30 AND 250),
  actividad  TEXT NOT NULL DEFAULT 'ligera'
             CHECK (actividad IN ('sedentaria', 'ligera', 'moderada', 'alta')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- AJUSTES DE LA COCINA (compartidos)
--   equipos: lo que hay en la cocina; la IA solo propone lo que
--            se puede hacer con ello. Cambia al mudarse.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_ajustes (
  clave      TEXT PRIMARY KEY,
  valor      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO super_ajustes (clave, valor)
VALUES ('equipos', '["fuegos", "microondas", "batidora", "picadora"]'::jsonb)
ON CONFLICT (clave) DO NOTHING;

-- Añadidos después (26/10/2026): platos fijos. Si la tabla ya existía, se añaden aquí.
ALTER TABLE super_recetas ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE super_recetas ADD COLUMN IF NOT EXISTS dia_fijo SMALLINT
  CHECK (dia_fijo IS NULL OR dia_fijo BETWEEN 1 AND 7);

CREATE INDEX IF NOT EXISTS idx_super_plan_fecha   ON super_plan(fecha);
CREATE INDEX IF NOT EXISTS idx_super_lista_orden  ON super_lista(comprado, seccion, created_at);

-- ─────────────────────────────────────────────────────────────
-- Bajo llave, como el resto: RLS sin políticas.
-- Solo el servidor (proxy /api/db con la cookie) puede tocarlas.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE super_recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_plan    ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_lista   ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_nevera  ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_ajustes  ENABLE ROW LEVEL SECURITY;
