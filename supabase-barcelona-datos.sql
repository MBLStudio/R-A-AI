-- ============================================================
-- R&A — Proyecto Barcelona · Datos de arranque
--
-- Ejecutar DESPUÉS de supabase-barcelona.sql.
-- Idempotente: puedes ejecutarlo varias veces sin duplicar.
--
-- QUÉ HACE
--   Deja el módulo lleno de información objetiva sobre Barcelona
--   —barrios con contexto real y un itinerario de descubrimiento—
--   para que vosotros solo tengáis que poner vuestra opinión:
--   las notas del 1 al 10 y lo que sintáis en cada sitio.
--
--   Nada de esto es un recuerdo vuestro: son barrios por conocer
--   y planes por hacer. Podéis mover fechas o borrar lo que no
--   os encaje desde la propia app.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. BARRIOS — descripciones con contexto útil para decidir
-- ─────────────────────────────────────────────────────────────

UPDATE bcn_barrios SET descripcion = CASE nombre
  WHEN 'Sant Antoni'  THEN 'Mercado modernista recién reformado, terrazas en el Paral·lel y vida de barrio real a diez minutos del centro. De los más buscados por parejas jóvenes: sube de precio cada año.'
  WHEN 'Gràcia'       THEN 'Plazas llenas de gente a todas horas, comercio independiente y aire de pueblo dentro de la ciudad. Calles estrechas, pisos antiguos y poca plaza de garaje.'
  WHEN 'Eixample'     THEN 'Las manzanas de Cerdà: aceras anchas, techos altos y todo bien comunicado. Pisos grandes y señoriales, precios de los más altos de la ciudad.'
  WHEN 'El Born'      THEN 'Callejones medievales, tiendas pequeñas y el Parc de la Ciutadella a mano. Precioso y muy transitado — vivir aquí es convivir con el turismo.'
  WHEN 'Gòtic'        THEN 'El corazón histórico. Espectacular para pasear, complicado para vivir: ruido, turismo constante y pisos oscuros de patio interior.'
  WHEN 'Poble-sec'    THEN 'Bajo Montjuïc, con las tapas de Carrer Blai y un ambiente auténtico. De los barrios céntricos más asequibles, aunque cuesta arriba en todos los sentidos.'
  WHEN 'Poblenou'     THEN 'La Rambla del Poblenou, playa a diez minutos andando y el ambiente más tranquilo del litoral. Antiguo barrio industrial reconvertido, con espacio y luz.'
  WHEN 'Sants'        THEN 'Auténtico, muy bien conectado (AVE, metro, buses) y de los más asequibles. Menos postal y más vida diaria de verdad.'
  WHEN 'El Raval'     THEN 'Multicultural, vivo y con muchísimo carácter. El más barato del centro, con la contrapartida de que la sensación cambia mucho de calle a calle.'
  WHEN 'Barceloneta'  THEN 'El mar a la puerta de casa. Pisos históricamente pequeños (los "quarts de casa"), mucho turismo en verano y un ambiente que no se parece a ningún otro.'
  WHEN 'Les Corts'    THEN 'Residencial, tranquilo y familiar, junto al Camp Nou y la zona universitaria. Poco ruido, poca noche, buena relación calidad-precio.'
  WHEN 'Sarrià'       THEN 'Verde, señorial y silencioso: la Barcelona más calmada. Casi otra ciudad — y precios acordes. Lejos del centro en tiempo real de trayecto.'
  ELSE descripcion
END
WHERE nombre IN ('Sant Antoni','Gràcia','Eixample','El Born','Gòtic','Poble-sec',
                 'Poblenou','Sants','El Raval','Barceloneta','Les Corts','Sarrià');


-- ─── Barrios adicionales que merece la pena mirar ────────────
INSERT INTO bcn_barrios (etapa_id, nombre, descripcion, lat, lng, color, orden)
SELECT e.id, b.nombre, b.descripcion, b.lat, b.lng, b.color, b.orden
FROM bcn_etapas e
CROSS JOIN (VALUES
  ('Sagrada Família',    'Alrededor del templo, pero a dos calles ya es un barrio normal y tranquilo. Bien comunicado, precios moderados y mucho piso reformado.', 41.4036, 2.1744, '#B8574B', 13),
  ('Eixample Esquerra',  'La mitad menos turística del Eixample, con el Mercat del Ninot y ambiente de barrio. Más asequible que la Dreta y igual de bien conectado.', 41.3860, 2.1560, '#7A9E7E', 14),
  ('El Clot',            'Barrio de toda la vida en plena transformación. Bien conectado por metro y Renfe, precios aún razonables y plaza con vida propia.', 41.4090, 2.1870, '#9C6B4F', 15),
  ('Vila Olímpica',      'Ordenado, moderno y con la playa al lado. Edificios de los 90, poco encanto histórico pero mucha calidad de vida.', 41.3890, 2.1970, '#3F9C8F', 16),
  ('Sant Gervasi',       'Zona alta: amplio, verde y muy tranquilo. Excelente para vivir si el presupuesto acompaña y no os importa depender del metro.', 41.4010, 2.1400, '#87A96B', 17),
  ('Hostafrancs',        'Pegado a Sants, con mercado propio y calle comercial. De los barrios céntricos con mejor precio por metro cuadrado.', 41.3750, 2.1430, '#6F7FA8', 18)
) AS b(nombre, descripcion, lat, lng, color, orden)
WHERE e.nombre = 'Barcelona 2026'
  AND NOT EXISTS (
    SELECT 1 FROM bcn_barrios x WHERE x.etapa_id = e.id AND x.nombre = b.nombre
  );


-- ─────────────────────────────────────────────────────────────
-- 2. ITINERARIO DE DESCUBRIMIENTO
--    Planes en la agenda, con fecha relativa a vuestra llegada.
--    Al vivirlos pasan solos a "Nuestra historia".
-- ─────────────────────────────────────────────────────────────

INSERT INTO bcn_momentos (etapa_id, fecha, estado, tipo, titulo, nota, barrio_id, autor, es_hito)
SELECT
  e.id,
  COALESCE(e.fecha_llegada, CURRENT_DATE) + p.dia,
  'previsto',
  p.tipo,
  p.titulo,
  p.nota,
  (SELECT id FROM bcn_barrios b WHERE b.etapa_id = e.id AND b.nombre = p.barrio),
  'ambos',
  false
FROM bcn_etapas e
CROSS JOIN (VALUES
  (1,  'explorar',    'Primer paseo por el Gòtic y el Born',  'Sin prisa y sin plan. Solo para hacerse a la ciudad.',                              'Gòtic'),
  (2,  'explorar',    'Sant Antoni y su mercado',             'Ver el mercado por dentro y tomar algo en alguna terraza del barrio.',              'Sant Antoni'),
  (3,  'explorar',    'Perderse por Gràcia',                  'Ir saltando de plaza en plaza: Vila de Gràcia, del Sol, de la Virreina.',           'Gràcia'),
  (4,  'playa',       'Tarde de playa en la Barceloneta',     'Para ver cómo es tener el mar a mano de verdad.',                                   'Barceloneta'),
  (5,  'explorar',    'Poble-sec y subida a Montjuïc',        'Tapas por Carrer Blai y subir a ver la ciudad desde arriba.',                       'Poble-sec'),
  (6,  'explorar',    'Poblenou y su Rambla',                 'El barrio con más espacio y más tranquilo del litoral.',                            'Poblenou'),
  (7,  'explorar',    'Eixample y Sagrada Família',           'Caminar las manzanas de Cerdà y ver el templo aunque sea por fuera.',               'Sagrada Família'),
  (9,  'explorar',    'Sants y Hostafrancs',                  'Los dos barrios con mejor precio. Ver si el ambiente os convence.',                 'Sants'),
  (11, 'rooftop',     'Atardecer en un rooftop',              'Elegid uno con vistas y quedaos hasta que se ponga el sol.',                        NULL),
  (13, 'excursion',   'Excursión a Sitges',                   'Tren desde Passeig de Gràcia, unos 40 minutos. Playa y pueblo bonito.',             NULL),
  (16, 'explorar',    'Zona alta: Sarrià y Sant Gervasi',     'Para comparar con el centro: mucho más tranquilo, más lejos de todo.',              'Sarrià'),
  (20, 'restaurante', 'Cena especial en algún sitio bueno',   'Uno que os apetezca de verdad, no el primero que salga en Google.',                 NULL)
) AS p(dia, tipo, titulo, nota, barrio)
WHERE e.nombre = 'Barcelona 2026'
  AND NOT EXISTS (
    SELECT 1 FROM bcn_momentos m WHERE m.etapa_id = e.id AND m.titulo = p.titulo
  );


-- ─────────────────────────────────────────────────────────────
-- 3. HITOS DE LA ETAPA
-- ─────────────────────────────────────────────────────────────

INSERT INTO bcn_momentos (etapa_id, fecha, estado, tipo, titulo, nota, autor, es_hito)
SELECT e.id, e.fecha_mudanza, 'previsto', 'mudanza',
       'Mudanza al piso definitivo',
       'El final de la búsqueda y el principio de vivir aquí de verdad.',
       'ambos', true
FROM bcn_etapas e
WHERE e.nombre = 'Barcelona 2026'
  AND e.fecha_mudanza IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM bcn_momentos m WHERE m.etapa_id = e.id AND m.tipo = 'mudanza'
  );


-- ─────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT 'barrios'   AS tabla, count(*) AS filas FROM bcn_barrios
UNION ALL
SELECT 'planes',   count(*) FROM bcn_momentos WHERE estado = 'previsto'
UNION ALL
SELECT 'vividos',  count(*) FROM bcn_momentos WHERE estado = 'vivido'
UNION ALL
SELECT 'etapas',   count(*) FROM bcn_etapas;
