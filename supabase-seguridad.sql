-- ============================================================
-- R&A — Blindaje de la base de datos
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de desplegar
-- la app con el proxy /api/db (si no, la app dejará de leer).
-- ============================================================
--
-- QUÉ HACE
--   Activa Row Level Security en todas las tablas y NO crea
--   ninguna política. Sin políticas, RLS deniega todo por
--   defecto: la anon key (que viaja en el JavaScript público)
--   deja de poder leer y escribir.
--
--   La service_role key SIEMPRE salta RLS, así que el servidor
--   —y solo el servidor— sigue teniendo acceso completo.
--
--   anon key   + RLS activo, sin políticas  ->  0 filas, 0 escrituras
--   service_role                            ->  acceso total
--
-- ES REVERSIBLE
--   Al final del archivo tienes el bloque para deshacerlo.
-- ============================================================

-- ─── Núcleo de la app ────────────────────────────────────────
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_memories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ─── Módulos ─────────────────────────────────────────────────
ALTER TABLE cartas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarro_momentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE intimidad_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE yopuedo_detalles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE yopuedo_sueno      ENABLE ROW LEVEL SECURITY;

-- ─── Proyecto Barcelona ──────────────────────────────────────
ALTER TABLE bcn_etapas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_barrios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_momentos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_pisos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_valoraciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_contactos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bcn_ia             ENABLE ROW LEVEL SECURITY;

-- ─── Tablas antiguas, por si siguen existiendo ───────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wardrobe', 'tfg_documents'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ─── Comprobación ────────────────────────────────────────────
-- Todas deben salir con rls = true y politicas = 0.
SELECT
  c.relname                                   AS tabla,
  c.relrowsecurity                            AS rls,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname)            AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;


-- ============================================================
-- DESHACER (solo si algo va mal y necesitas volver atrás)
-- ============================================================
-- ALTER TABLE users              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profiles      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE memories           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE shared_memories    DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE cartas             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tarro_momentos     DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE intimidad_registro DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE yopuedo_detalles   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE yopuedo_sueno      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_etapas         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_barrios        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_momentos       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_pisos          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_valoraciones   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_contactos      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE bcn_ia             DISABLE ROW LEVEL SECURITY;
