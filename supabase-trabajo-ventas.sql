-- ============================================================
-- R&A · Proyecto Barcelona — TRABAJO: ventas de Rut (del cuaderno)
--
-- Del 13 al 20 de octubre, tal y como las apuntó a mano.
-- No hay hora apuntada: se pone la de salida de su turno, y se
-- puede corregir desde la app tocando la venta.
--
-- Ejecutar DESPUÉS de supabase-trabajo.sql. Si ya hay ventas
-- apuntadas en esos días, no mete nada (para no duplicarlas).
-- ============================================================

INSERT INTO trabajo_ventas (user_name, fecha, hora, nombre, precio, nota)
SELECT 'rut', v.fecha::date, v.hora::time, v.nombre, v.precio::numeric(10,2), v.nota
FROM (VALUES
  -- 1.ª semana · 3.416 €
  ('2026-10-13', '20:30', 'Gafas de sol', '179', NULL),
  ('2026-10-13', '20:30', 'Gafas de sol', '219', NULL),
  ('2026-10-13', '20:30', 'Gafas de sol', '269', NULL),
  ('2026-10-13', '20:30', 'Gafas de sol', '219', NULL),
  ('2026-10-13', '20:30', 'Gafas de ver', '269', NULL),

  ('2026-10-14', '21:15', 'Gafas de sol', '195', NULL),
  ('2026-10-14', '21:15', 'Gafas de sol', '209', NULL),
  ('2026-10-14', '21:15', 'Gafas de sol', '229', NULL),
  ('2026-10-14', '21:15', 'Gafas de sol', '199', NULL),
  ('2026-10-14', '21:15', 'Gafas de sol', '189', NULL),
  -- Sin precio en el cuaderno: es lo que falta para cuadrar los 3.416 € de la semana
  ('2026-10-14', '21:15', 'Gafas de ver (oferta universitaria)', '169', 'Precio deducido del total de la semana: confírmalo'),

  ('2026-10-15', '20:30', 'Gafas de sol', '219', NULL),

  ('2026-10-17', '15:00', 'Gafas de ver', '195', NULL),
  ('2026-10-17', '15:00', 'Gafas de sol', '219', NULL),
  ('2026-10-17', '15:00', 'Gafas de sol', '189', NULL),
  ('2026-10-17', '15:00', 'Gafas de sol', '249', NULL),

  -- 2.ª semana
  ('2026-10-19', '15:00', 'Gafas de sol', '245', NULL),
  ('2026-10-19', '15:00', 'Readers (gafas de lectura)', '49', NULL),

  ('2026-10-20', '18:00', 'Batlló', '439', NULL),
  ('2026-10-20', '18:00', 'Gafas de sol', '109', '2 iguales'),
  ('2026-10-20', '18:00', 'Gafas de sol', '109', '2 iguales'),
  ('2026-10-20', '18:00', 'Gafas de sol', '229', NULL),
  ('2026-10-20', '18:00', 'Gafas de sol', '189', NULL),
  ('2026-10-20', '18:00', 'Gafas de sol', '245', NULL)
) AS v(fecha, hora, nombre, precio, nota)
WHERE NOT EXISTS (
  SELECT 1 FROM trabajo_ventas
  WHERE user_name = 'rut' AND fecha BETWEEN '2026-10-13' AND '2026-10-20'
);

-- Comprobación por semana: debe salir 3.416 € (16 ventas) y 1.614 € (8 ventas)
SELECT
  date_trunc('week', fecha)::date AS semana,
  COUNT(*)    AS ventas,
  SUM(precio) AS total
FROM trabajo_ventas
WHERE user_name = 'rut'
GROUP BY 1 ORDER BY 1;
