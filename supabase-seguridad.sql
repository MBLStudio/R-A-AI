-- ============================================================
-- R&A — Blindaje de la base de datos
--
-- ⚠️ EJECUTAR SOLO DESPUÉS de haber desplegado la app con el
--    proxy /api/db y de haber puesto APP_PASSWORD en Vercel.
--    Si lo ejecutas antes, la app deja de leer datos.
-- ============================================================
--
-- QUÉ HACE
--   Activa Row Level Security en TODAS las tablas de `public`
--   y no crea ninguna política. Sin políticas, RLS deniega todo
--   por defecto: la anon key (que viaja en el JavaScript
--   público) deja de poder leer y escribir.
--
--   La service_role key SIEMPRE salta RLS, así que el servidor
--   —y solo el servidor— conserva acceso completo.
--
--     anon key    + RLS activo sin políticas  ->  0 filas
--     service_role                            ->  acceso total
--
--   Recorre las tablas dinámicamente, así que funciona sin
--   importar cuáles existan y no hay que mantener listas.
--   Es idempotente: ejecútalo las veces que quieras.
-- ============================================================

DO $$
DECLARE
  t   record;
  n   integer := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relkind = 'r'          -- solo tablas normales
      AND NOT c.relrowsecurity      -- las que aún no lo tienen
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS activado en %', t.relname;
    n := n + 1;
  END LOOP;

  RAISE NOTICE '── % tablas blindadas ──', n;
END $$;


-- ============================================================
-- COMPROBACIÓN
-- Todas deben salir con rls = true y politicas = 0.
-- Si alguna sale con rls = false, no se blindó: avisa.
-- ============================================================
SELECT
  c.relname        AS tabla,
  c.relrowsecurity AS rls,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
FROM pg_class c
JOIN pg_namespace ns ON ns.oid = c.relnamespace
WHERE ns.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;


-- ============================================================
-- DESHACER  (solo si algo va mal y necesitas volver atrás)
-- Descomenta el bloque entero y ejecútalo.
-- ============================================================
-- DO $$
-- DECLARE t record;
-- BEGIN
--   FOR t IN
--     SELECT c.relname FROM pg_class c
--     JOIN pg_namespace ns ON ns.oid = c.relnamespace
--     WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.relname);
--   END LOOP;
-- END $$;
