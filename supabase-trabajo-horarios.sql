-- ============================================================
-- R&A · Proyecto Barcelona — TRABAJO: horarios de Rut y Alejandro
--
-- Sacados de las capturas del cuadrante de la tienda.
-- La pausa (en rojo en el cuadrante) va dentro del turno y
-- cuenta como hora trabajada, así que se apunta en la nota.
--
-- Ejecutar DESPUÉS de supabase-trabajo.sql. Se puede repetir:
-- si un día ya existe, se sobrescribe con lo de aquí.
-- ============================================================

INSERT INTO trabajo_turnos (user_name, fecha, tipo, tramos, nota) VALUES
  -- Semana del 13 al 18 de octubre · 25 h (empezó el martes 13)
  ('rut', '2026-10-13', 'trabajo', '[{"inicio":"14:30","fin":"20:30"}]', NULL),
  ('rut', '2026-10-14', 'trabajo', '[{"inicio":"13:15","fin":"21:15"}]', NULL),
  ('rut', '2026-10-15', 'trabajo', '[{"inicio":"14:30","fin":"20:30"}]', NULL),
  ('rut', '2026-10-16', 'libre',   '[]', NULL),
  ('rut', '2026-10-17', 'trabajo', '[{"inicio":"10:00","fin":"15:00"}]', NULL),
  ('rut', '2026-10-18', 'libre',   '[]', NULL),

  -- Semana del 19 al 25 de octubre · 30 h
  ('rut', '2026-10-19', 'trabajo', '[{"inicio":"10:00","fin":"15:00"}]', NULL),
  ('rut', '2026-10-20', 'trabajo', '[{"inicio":"10:00","fin":"18:00"}]', 'Pausa 13:30–14:00'),
  ('rut', '2026-10-21', 'libre',   '[]', NULL),
  ('rut', '2026-10-22', 'trabajo', '[{"inicio":"10:00","fin":"15:00"}]', 'Pausa 13:30–14:00'),
  ('rut', '2026-10-23', 'trabajo', '[{"inicio":"14:15","fin":"21:15"}]', 'Pausa 18:00–18:30'),
  ('rut', '2026-10-24', 'trabajo', '[{"inicio":"11:00","fin":"16:00"}]', NULL),
  ('rut', '2026-10-25', 'libre',   '[]', NULL),

  -- Semana del 26 de octubre al 1 de noviembre · 30 h
  ('rut', '2026-10-26', 'trabajo', '[{"inicio":"10:00","fin":"16:30"}]', 'Pausa 13:00–13:30'),
  ('rut', '2026-10-27', 'libre',   '[]', NULL),
  ('rut', '2026-10-28', 'libre',   '[]', NULL),
  ('rut', '2026-10-29', 'trabajo', '[{"inicio":"13:30","fin":"21:30"}]', 'Pausa 18:00–18:30'),
  ('rut', '2026-10-30', 'trabajo', '[{"inicio":"10:00","fin":"16:30"}]', 'Pausa 13:30–14:00'),
  ('rut', '2026-10-31', 'trabajo', '[{"inicio":"16:00","fin":"21:00"}]', NULL),
  ('rut', '2026-11-01', 'trabajo', '[{"inicio":"16:00","fin":"20:00"}]', NULL),

  -- Semana del 2 al 8 de noviembre · 27 h
  ('rut', '2026-11-02', 'trabajo', '[{"inicio":"15:00","fin":"21:00"}]', 'Pausa 17:30–18:00'),
  ('rut', '2026-11-03', 'trabajo', '[{"inicio":"15:00","fin":"21:00"}]', 'Pausa 17:30–18:00'),
  ('rut', '2026-11-04', 'libre',   '[]', NULL),
  ('rut', '2026-11-05', 'trabajo', '[{"inicio":"12:00","fin":"17:00"}]', NULL),
  ('rut', '2026-11-06', 'libre',   '[]', NULL),
  ('rut', '2026-11-07', 'trabajo', '[{"inicio":"11:00","fin":"17:00"}]', 'Pausa 15:00–15:30'),
  ('rut', '2026-11-08', 'trabajo', '[{"inicio":"12:00","fin":"16:00"}]', NULL),

  -- Semana del 9 al 15 de noviembre · 29 h 30 min
  ('rut', '2026-11-09', 'trabajo', '[{"inicio":"13:00","fin":"21:00"}]', 'Pausa 15:30–16:00'),
  ('rut', '2026-11-10', 'trabajo', '[{"inicio":"15:30","fin":"20:30"}]', NULL),
  ('rut', '2026-11-11', 'libre',   '[]', NULL),
  ('rut', '2026-11-12', 'trabajo', '[{"inicio":"15:00","fin":"21:00"}]', NULL),
  ('rut', '2026-11-13', 'trabajo', '[{"inicio":"15:00","fin":"21:00"}]', NULL),
  ('rut', '2026-11-14', 'trabajo', '[{"inicio":"16:30","fin":"21:00"}]', NULL),
  ('rut', '2026-11-15', 'libre',   '[]', NULL)
ON CONFLICT (user_name, fecha) DO UPDATE SET
  tipo       = EXCLUDED.tipo,
  tramos     = EXCLUDED.tramos,
  nota       = EXCLUDED.nota,
  updated_at = NOW();

-- ============================================================
-- ALEJANDRO — horario fijo, del 19 de octubre al 31 de diciembre
--   lunes a jueves 9:00–17:00 · viernes 9:00–16:00 · finde libre
--   festivos: 2 nov, 7 dic, 8 dic y 25 dic
-- Se genera día a día: cada día es su fila y se puede cambiar
-- desde la app. Ojo: volver a ejecutar esto pisa esos cambios.
-- ============================================================

INSERT INTO trabajo_turnos (user_name, fecha, tipo, tramos, nota)
SELECT
  'alejandro',
  d::date,
  CASE
    WHEN d::date IN ('2026-11-02', '2026-12-07', '2026-12-08', '2026-12-25') THEN 'festivo'
    WHEN EXTRACT(ISODOW FROM d) >= 6 THEN 'libre'
    ELSE 'trabajo'
  END,
  CASE
    WHEN d::date IN ('2026-11-02', '2026-12-07', '2026-12-08', '2026-12-25')
      OR EXTRACT(ISODOW FROM d) >= 6 THEN '[]'::jsonb
    WHEN EXTRACT(ISODOW FROM d) = 5 THEN '[{"inicio":"09:00","fin":"16:00"}]'::jsonb
    ELSE '[{"inicio":"09:00","fin":"17:00"}]'::jsonb
  END,
  NULL
FROM generate_series('2026-10-19'::date, '2026-12-31'::date, interval '1 day') AS d
ON CONFLICT (user_name, fecha) DO UPDATE SET
  tipo       = EXCLUDED.tipo,
  tramos     = EXCLUDED.tramos,
  nota       = EXCLUDED.nota,
  updated_at = NOW();

-- Comprobación: horas por semana y persona
--   Rut: 25 · 30 · 30 · 27 · 29,5
--   Alejandro: 39 (31 la semana del 2 nov, 23 la del 7 dic, 32 la del 21 dic
--              y 32 la del 28 dic, que solo llega hasta el jueves 31)
SELECT
  user_name,
  date_trunc('week', fecha)::date AS semana,
  SUM(
    CASE WHEN tipo = 'trabajo' THEN
      (SELECT SUM(EXTRACT(EPOCH FROM ((t->>'fin')::time - (t->>'inicio')::time)) / 3600)
       FROM jsonb_array_elements(tramos) t)
    ELSE 0 END
  ) AS horas
FROM trabajo_turnos
GROUP BY 1, 2 ORDER BY 1, 2;
