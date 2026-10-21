-- ============================================================
-- R&A · Proyecto Barcelona — TRABAJO (horario y ventas)
--
-- Dos tablas:
--
--   · trabajo_turnos → UNA FILA POR DÍA. Dice si se trabaja,
--                      se libra o se está de vacaciones, y
--                      guarda dentro los tramos del día (uno,
--                      o dos si es turno partido).
--   · trabajo_ventas → una fila por venta, con su hora.
--
-- Los precios son NUMERIC(10,2): céntimos exactos, nunca float.
--
-- Ejecutar una vez en el editor SQL de Supabase. Es idempotente.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TURNOS — un día, una fila
-- tramos = [{"inicio":"10:00","fin":"14:00"},{"inicio":"17:00","fin":"21:00"}]
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trabajo_turnos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name   TEXT NOT NULL CHECK (user_name IN ('alejandro', 'rut')),
  fecha       DATE NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'trabajo',
  tramos      JSONB NOT NULL DEFAULT '[]'::jsonb,
  nota        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  -- Un día no puede estar apuntado dos veces
  UNIQUE (user_name, fecha),
  -- Un día de trabajo tiene que tener al menos un tramo
  CHECK (tipo <> 'trabajo' OR jsonb_array_length(tramos) > 0)
);

-- ─────────────────────────────────────────────────────────────
-- VENTAS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trabajo_ventas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name   TEXT NOT NULL CHECK (user_name IN ('alejandro', 'rut')),
  fecha       DATE NOT NULL,
  hora        TIME NOT NULL,
  nombre      TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  precio      NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  nota        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de día. Aparte del CREATE para que también se actualice
-- si la tabla ya existía (se añadió 'festivo' después).
ALTER TABLE trabajo_turnos DROP CONSTRAINT IF EXISTS trabajo_turnos_tipo_check;
ALTER TABLE trabajo_turnos ADD CONSTRAINT trabajo_turnos_tipo_check
  CHECK (tipo IN ('trabajo', 'libre', 'vacaciones', 'festivo'));

CREATE INDEX IF NOT EXISTS idx_trabajo_ventas_fecha ON trabajo_ventas(user_name, fecha, hora);

-- ─────────────────────────────────────────────────────────────
-- Bajo llave, como el resto: RLS sin políticas.
-- Solo el servidor (proxy /api/db con la cookie) puede tocarlas.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE trabajo_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabajo_ventas ENABLE ROW LEVEL SECURITY;
