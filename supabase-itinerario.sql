-- ============================================================
-- R&A — Barcelona 2026 · Itinerario del viaje 8-16 de agosto
--
-- Sustituye el itinerario genérico del seed por el viaje real.
-- Idempotente: puedes ejecutarlo varias veces.
--
-- Todo esto es una IDEA, no una obligación. Cada evento se puede
-- mover, editar o borrar desde la app.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Fuera el itinerario genérico del seed anterior
-- ─────────────────────────────────────────────────────────────
DELETE FROM bcn_momentos
WHERE estado = 'previsto'
  AND titulo IN (
    'Primer paseo por el Gòtic y el Born', 'Sant Antoni y su mercado',
    'Perderse por Gràcia', 'Tarde de playa en la Barceloneta',
    'Poble-sec y subida a Montjuïc', 'Poblenou y su Rambla',
    'Eixample y Sagrada Família', 'Sants y Hostafrancs',
    'Atardecer en un rooftop', 'Excursión a Sitges',
    'Zona alta: Sarrià y Sant Gervasi', 'Cena especial en algún sitio bueno'
  );


-- ─────────────────────────────────────────────────────────────
-- 2. El viaje, día a día
-- ─────────────────────────────────────────────────────────────
INSERT INTO bcn_momentos (etapa_id, fecha, hora, estado, tipo, titulo, nota, lugar, barrio_id, autor, es_hito)
SELECT
  e.id, p.fecha::date, p.hora::time, 'previsto', p.tipo, p.titulo, p.nota, p.lugar,
  (SELECT id FROM bcn_barrios b WHERE b.etapa_id = e.id AND b.nombre = p.barrio),
  p.autor, p.hito
FROM bcn_etapas e
CROSS JOIN (VALUES

-- ══ VIERNES 8 · LLEGADA ══════════════════════════════════════
('2026-08-08','16:30','llegada','Llegamos a Barcelona',
 'El principio de todo. Dejar las maletas en el alojamiento, descansar un rato y salir sin prisa.',
 NULL, NULL, 'ambos', true),

('2026-08-08','18:30','explorar','Primer paseo: Gràcia, Catalunya y el Gòtic',
 'Passeig de Gràcia hasta Plaça Catalunya, bajar por Rambla Catalunya y meterse en el Barrio Gótico sin rumbo fijo. Solo mirar y hacerse a la ciudad.',
 'Passeig de Gràcia', 'Gòtic', 'ambos', false),

('2026-08-08','21:30','restaurante','Primera cena en Barcelona',
 'Algo tranquilo cerca del alojamiento. No buscamos nada especial: solo disfrutar de la primera noche. Y la primera foto juntos aquí.',
 NULL, NULL, 'ambos', true),

-- ══ SÁBADO 9 · EL CENTRO ═════════════════════════════════════
('2026-08-09','10:30','explorar','El corazón histórico',
 'Barrio Gótico y la Catedral. Callejear sin recorrido fijo: la gracia está en perderse.',
 'Catedral de Barcelona', 'Gòtic', 'ambos', false),

('2026-08-09','13:30','restaurante','Comida por el Born',
 'Algo típico por la zona. Sin reserva, lo que apetezca al pasar.',
 NULL, 'El Born', 'ambos', false),

('2026-08-09','16:00','explorar','El Born, Arc de Triomf y Ciutadella',
 'Del Born al Arc de Triomf y de ahí al Parc de la Ciutadella. Entrar en tiendas, tomar un café, sin prisa.',
 'Parc de la Ciutadella', 'El Born', 'ambos', false),

('2026-08-09','20:00','explorar','Paseo por el Port Vell',
 'Bajar hasta el puerto y pasear al atardecer.',
 'Port Vell', 'Barceloneta', 'ambos', false),

-- ══ DOMINGO 10 · BARRIOS ═════════════════════════════════════
('2026-08-10','10:00','explorar','Sant Antoni con ojos de vecino',
 'Hoy no hacemos turismo: imaginamos cómo sería vivir aquí. Mirar el mercado, los comercios, el supermercado más cercano, las cafeterías, si hay gimnasio. Y sobre todo: cuánto ruido hay y qué sensación da.',
 'Mercat de Sant Antoni', 'Sant Antoni', 'ambos', false),

('2026-08-10','12:30','explorar','Eixample: las manzanas de Cerdà',
 'Caminar las calles anchas. Ver si el barrio se siente vivo o solo elegante. Fijarse en el transporte y en cuánto se tarda a todo.',
 NULL, 'Eixample', 'ambos', false),

('2026-08-10','16:30','explorar','Gràcia, plaza por plaza',
 'Plaça de la Vila, del Sol, de la Virreina. Ver si ese aire de pueblo dentro de la ciudad nos encaja o se nos queda pequeño.',
 'Plaça del Sol', 'Gràcia', 'ambos', false),

('2026-08-10','19:00','explorar','Poble-sec y Carrer Blai',
 'Tapas por Blai y ver el barrio de noche, que es cuando se conoce de verdad.',
 'Carrer de Blai', 'Poble-sec', 'ambos', false),

('2026-08-10','22:00','otro','Valorar los cuatro barrios',
 'Antes de dormir, cada uno pone sus notas en la app. Sin mirar las del otro primero — luego comparamos y vemos dónde coincidimos.',
 NULL, NULL, 'ambos', false),

-- ══ LUNES 11 · VIVIENDAS ═════════════════════════════════════
('2026-08-11','10:00','visita_piso','Visitas de pisos · mañana',
 'Objetivo del día: entre 3 y 5 visitas. PREGUNTAR SIEMPRE: gastos incluidos, fianza, fecha de entrada, tipo de contrato, duración mínima y si se puede entrar en octubre.',
 NULL, NULL, 'ambos', true),

('2026-08-11','13:00','explorar','Entre visita y visita',
 'Aprovechar los huecos para pisar la calle: entrar en el súper, ver el ambiente a esa hora, cuánto se tarda al metro.',
 NULL, NULL, 'ambos', false),

('2026-08-11','16:30','visita_piso','Visitas de pisos · tarde',
 'Guardar cada piso en la app nada más salir, con foto y con la sensación en caliente. Al día siguiente ya no te acuerdas.',
 NULL, NULL, 'ambos', false),

('2026-08-11','21:30','restaurante','Cena para celebrar el día',
 'Reservar algo bueno. Ha sido el día importante de la búsqueda.',
 NULL, NULL, 'ambos', false),

-- ══ MARTES 12 · ENTREVISTA ═══════════════════════════════════
('2026-08-12','10:00','cita','Entrevista de Rut en Etnia Barcelona',
 'El motivo de fondo de todo esto. Ciutat Vella. Mucha suerte.',
 'Etnia Barcelona · Ciutat Vella', 'Gòtic', 'rut', true),

('2026-08-12','10:00','explorar','Alejandro: dar una vuelta por Ciutat Vella',
 'Mientras tanto, descubrir la zona con calma: cafeterías, ambiente, cómo se vive por aquí un martes por la mañana.',
 'Ciutat Vella', 'Gòtic', 'alejandro', false),

('2026-08-12','13:30','restaurante','Comer juntos y comentar la entrevista',
 'Cómo ha ido, qué sensaciones, qué han dicho. Celebrarlo pase lo que pase.',
 NULL, NULL, 'ambos', true),

('2026-08-12','17:00','playa','Tarde de playa en Bogatell',
 'La mejor de las urbanas. Si está muy llena, Nova Icària está al lado.',
 'Platja del Bogatell', 'Poblenou', 'ambos', false),

('2026-08-12','20:30','explorar','Atardecer por Vila Olímpica y Port Olímpic',
 'Paseo marítimo hasta el Port Olímpic. Buen momento para hablar de cómo se ve todo esto.',
 'Port Olímpic', 'Vila Olímpica', 'ambos', false),

-- ══ MIÉRCOLES 13 · VIVIR AQUÍ ════════════════════════════════
('2026-08-13','10:00','otro','Un día normal, como si ya viviéramos aquí',
 'Hoy no hay monumentos. Coger el metro, ir a comprar, tomar café donde lo tomaríamos siempre, entrar en un gimnasio a preguntar precios, mirar un súper de verdad. El día que más nos va a decir.',
 NULL, NULL, 'ambos', false),

('2026-08-13','18:00','explorar','Nuestro barrio favorito, otra vez',
 'Volver al que más nos haya gustado hasta ahora y pasar la tarde entera allí. A ver si aguanta la segunda impresión.',
 NULL, NULL, 'ambos', false),

-- ══ JUEVES 14 · SITGES ═══════════════════════════════════════
('2026-08-14','09:30','excursion','Sitges',
 'Rodalies desde Barcelona Sants, unos 35-45 minutos. Casco antiguo, la iglesia frente al mar, las calles blancas y el paseo marítimo. Comer junto al mar, playa, helado y volver cuando apetezca. Sin horarios.',
 'Sitges', NULL, 'ambos', false),

-- ══ VIERNES 15 · ÚLTIMO DÍA ══════════════════════════════════
('2026-08-15','11:00','explorar','Último día: lo que quedó pendiente',
 'Volver al barrio favorito, entrar en las tiendas que dejamos a medias, comprar algún recuerdo, repetir el restaurante que más nos gustó.',
 NULL, NULL, 'ambos', false),

('2026-08-15','19:30','rooftop','Rooftop al atardecer',
 'Un cóctel viendo la ciudad desde arriba. Y la conversación importante: qué barrio nos gusta más, cómo ha ido el viaje, cómo vemos nuestro futuro aquí.',
 NULL, NULL, 'ambos', true),

('2026-08-15','22:00','restaurante','Cena especial de despedida',
 'Un sitio bonito de verdad. Celebrar que esto empieza. Luego a casa pronto y a preparar maletas.',
 NULL, NULL, 'ambos', true),

-- ══ SÁBADO 16 · VUELTA ═══════════════════════════════════════
('2026-08-16','06:00','otro','Vuelta a casa · vuelo 08:50',
 'Levantarse con calma, último paseo si da tiempo y al aeropuerto. No volvemos diciendo "hemos visto Barcelona": volvemos sabiendo movernos por ella.',
 'Aeropuerto El Prat', NULL, 'ambos', true)

) AS p(fecha, hora, tipo, titulo, nota, lugar, barrio, autor, hito)
WHERE e.nombre = 'Barcelona 2026'
  AND NOT EXISTS (
    SELECT 1 FROM bcn_momentos m
    WHERE m.etapa_id = e.id AND m.titulo = p.titulo AND m.fecha = p.fecha::date
  );


-- ─────────────────────────────────────────────────────────────
-- 3. Lista de deseos — sin fecha fija, para encajar donde salga
-- ─────────────────────────────────────────────────────────────
INSERT INTO bcn_momentos (etapa_id, fecha, estado, tipo, titulo, nota, lugar, autor, es_hito)
SELECT e.id, '2026-08-13'::date, 'previsto', p.tipo, p.titulo, p.nota, p.lugar, 'ambos', false
FROM bcn_etapas e
CROSS JOIN (VALUES
  ('explorar',    'Búnkers del Carmel',        'Las mejores vistas de Barcelona y gratis. Ir al atardecer, llevar algo de beber. Se llena, mejor entre semana.', 'Búnkers del Carmel'),
  ('explorar',    'Tibidabo',                  'La montaña con el parque de atracciones antiguo y el templo. Vistas de toda la ciudad y el mar.', 'Tibidabo'),
  ('explorar',    'Montjuïc',                  'Castillo, jardines y el teleférico. Se puede combinar con Poble-sec.', 'Montjuïc'),
  ('explorar',    'Sagrada Família',           'Aunque sea por fuera. Si entramos, sacar entradas online con antelación.', 'Sagrada Família'),
  ('explorar',    'Casa Batlló y La Pedrera',  'Las dos en Passeig de Gràcia, se ven de camino. Por fuera ya impresionan.', 'Passeig de Gràcia'),
  ('explorar',    'Mercat de la Boqueria',     'Turístico pero hay que verlo una vez. Ir temprano.', 'La Rambla'),
  ('explorar',    'El Born de noche',          'El barrio cambia por completo cuando anochece.', 'El Born'),
  ('restaurante', 'Vinitus',                   'Tapas. Suele haber cola, no aceptan reserva en todos los locales.', 'Vinitus'),
  ('restaurante', 'Can Fisher',                'Arroces junto a la playa, en Nova Icària. Reservar.', 'Can Fisher · Nova Icària'),
  ('restaurante', 'El Nacional',               'Antiguo taller reconvertido en varios restaurantes bajo un mismo techo. Muy bonito por dentro.', 'El Nacional · Passeig de Gràcia'),
  ('rooftop',     'Grand Hotel Central',       'La piscina infinita con vistas al Gòtic. De los más conocidos.', 'Grand Hotel Central'),
  ('rooftop',     'Hotel 1898',                'En plena Rambla, con vistas al centro.', 'Hotel 1898'),
  ('rooftop',     'The Barcelona EDITION',     'El más moderno de los tres, cerca del Born.', 'The Barcelona EDITION')
) AS p(tipo, titulo, nota, lugar)
WHERE e.nombre = 'Barcelona 2026'
  AND NOT EXISTS (SELECT 1 FROM bcn_momentos m WHERE m.etapa_id = e.id AND m.titulo = p.titulo);


-- ─────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ─────────────────────────────────────────────────────────────
SELECT fecha, COALESCE(to_char(hora,'HH24:MI'),'—') AS hora, tipo, titulo
FROM bcn_momentos
WHERE estado = 'previsto'
ORDER BY fecha, hora NULLS FIRST;
