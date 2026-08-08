-- ============================================================
-- R&A · Proyecto Barcelona — GASTOS
--
-- Dos maneras de pagar, que conviven:
--
--   · Del BOTE   → la caja común. Sale de ahí y es de los dos.
--   · Del BOLSILLO → lo adelanta uno. Se apunta quién, y así
--                    se ve quién ha puesto más.
--
-- Meter dinero en el bote es un movimiento más, de signo
-- contrario. Así el saldo siempre sale de sumar y restar lo
-- que hay apuntado: no hay un número que pueda descuadrarse.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- BOTES — cada hucha con su nombre
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_botes (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id   UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  color      TEXT DEFAULT '#C1502E',
  objetivo   NUMERIC,          -- opcional: "queremos juntar 3.000 €"
  orden      INTEGER DEFAULT 0,
  archivado  BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- GASTOS Y APORTACIONES
-- El importe va siempre en positivo; manda la columna `tipo`.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_gastos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id    UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto    TEXT NOT NULL,
  importe     NUMERIC NOT NULL CHECK (importe >= 0),
  tipo        TEXT NOT NULL DEFAULT 'gasto',   -- 'gasto' | 'aportacion'
  -- De dónde sale el dinero: del bote (a medias) o del bolsillo de uno
  pagado_por  TEXT NOT NULL DEFAULT 'bote',    -- 'bote' | 'alejandro' | 'rut'
  bote_id     UUID REFERENCES bcn_botes(id) ON DELETE SET NULL,
  categoria   TEXT DEFAULT 'otros',
  ticket_url  TEXT,                            -- la foto del ticket, si la hay
  nota        TEXT,
  -- Si viene de un gasto fijo, de cuál y de qué mes (para no duplicarlo)
  fijo_id     UUID,
  fijo_periodo TEXT,                           -- '2026-08'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- GASTOS FIJOS — se apuntan una vez y vuelven cada mes
-- El importe es editable: la luz nunca viene igual.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bcn_gastos_fijos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id    UUID REFERENCES bcn_etapas(id) ON DELETE CASCADE,
  concepto    TEXT NOT NULL,
  importe     NUMERIC NOT NULL CHECK (importe >= 0),
  dia         INTEGER NOT NULL DEFAULT 1 CHECK (dia BETWEEN 1 AND 31),
  pagado_por  TEXT NOT NULL DEFAULT 'bote',
  bote_id     UUID REFERENCES bcn_botes(id) ON DELETE SET NULL,
  categoria   TEXT DEFAULT 'casa',
  activo      BOOLEAN DEFAULT true,
  desde       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bcn_gastos
  ADD CONSTRAINT bcn_gastos_fijo_fk
  FOREIGN KEY (fijo_id) REFERENCES bcn_gastos_fijos(id) ON DELETE SET NULL;

-- Un gasto fijo solo puede apuntarse una vez por mes
CREATE UNIQUE INDEX IF NOT EXISTS idx_gastos_fijo_periodo
  ON bcn_gastos(fijo_id, fijo_periodo)
  WHERE fijo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gastos_etapa_fecha ON bcn_gastos(etapa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_bote        ON bcn_gastos(bote_id);

-- ─────────────────────────────────────────────────────────────
-- Bajo llave, como el resto
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bcn_botes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_gastos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_gastos_fijos ENABLE ROW LEVEL SECURITY;

-- Un bote para empezar
INSERT INTO bcn_botes (etapa_id, nombre, color, orden)
SELECT id, 'Bote común', '#C1502E', 0
FROM bcn_etapas
WHERE activa = true
  AND NOT EXISTS (SELECT 1 FROM bcn_botes WHERE bcn_botes.etapa_id = bcn_etapas.id);
