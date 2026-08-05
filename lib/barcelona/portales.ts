// ============================================================
// R&A — Los nueve portales, con vuestra búsqueda ya hecha
//
// Esto no lee nada ni descarga nada: solo construye la
// dirección de búsqueda de cada portal con vuestros filtros.
// Por eso no se puede romper — y por eso es la parte de la
// extensión que siempre funcionó.
// ============================================================

export interface Criterios {
  precioMax: number;
  habitaciones: number;
  m2Min: number;
  ascensor: boolean;
  terraza: boolean;
  mascotas: boolean;
}

export const CRITERIOS_POR_DEFECTO: Criterios = {
  precioMax: 1100,
  habitaciones: 2,
  m2Min: 0,
  ascensor: false,
  terraza: false,
  mascotas: false,
};

export interface Portal {
  id: string;
  nombre: string;
  /** Para que cada uno se reconozca de un vistazo. */
  color: string;
  url: (c: Criterios) => string;
}

/** Idealista filtra por trozos de ruta, no por parámetros. */
function rutaIdealista(c: Criterios): string {
  const filtros = [`con-precio-hasta-${c.precioMax}`];

  if (c.habitaciones === 1) filtros.push("de-un-dormitorio");
  else if (c.habitaciones === 2) filtros.push("de-dos-dormitorios");
  else if (c.habitaciones >= 3) filtros.push("de-tres-dormitorios");

  if (c.m2Min >= 60) filtros.push("con-metros-cuadrados-mas-de-60");
  else if (c.m2Min >= 40) filtros.push("con-metros-cuadrados-mas-de-40");

  if (c.terraza) filtros.push("con-terraza");
  if (c.ascensor) filtros.push("con-ascensor");
  if (c.mascotas) filtros.push("se-admiten-mascotas");

  return `https://www.idealista.com/alquiler-viviendas/barcelona-barcelona/${filtros.join(",")}/?ordenado-por=fecha-publicacion-desc`;
}

export const PORTALES: Portal[] = [
  { id: "idealista", nombre: "Idealista", color: "#C1502E", url: rutaIdealista },
  {
    id: "fotocasa",
    nombre: "Fotocasa",
    color: "#1B5E7E",
    url: (c) =>
      `https://www.fotocasa.es/es/alquiler/viviendas/barcelona-capital/todas-las-zonas/l?maxPrice=${c.precioMax}` +
      (c.habitaciones ? `&minRooms=${c.habitaciones}` : "") +
      (c.m2Min ? `&minSurface=${c.m2Min}` : "") +
      `&sortType=publicationDate&sortOrder=desc`,
  },
  {
    id: "habitaclia",
    nombre: "Habitaclia",
    color: "#6B8F71",
    url: (c) =>
      `https://www.habitaclia.com/alquiler-barcelona.htm?precio_max=${c.precioMax}` +
      (c.habitaciones ? `&habitaciones_min=${c.habitaciones}` : "") +
      (c.m2Min ? `&superficie_min=${c.m2Min}` : "") +
      `&orderby=date_desc`,
  },
  {
    id: "pisos",
    nombre: "Pisos.com",
    color: "#E8A33D",
    url: (c) =>
      `https://www.pisos.com/alquiler/pisos-barcelona/?precio_maximo=${c.precioMax}` +
      (c.habitaciones ? `&habitaciones_minimas=${c.habitaciones}` : "") +
      `&ordenacion=fecha_publicacion`,
  },
  {
    id: "enalquiler",
    nombre: "Enalquiler",
    color: "#8E3A20",
    url: (c) =>
      `https://www.enalquiler.com/en-alquiler/pisos/barcelona/?precio_hasta=${c.precioMax}` +
      (c.habitaciones ? `&habitaciones=${c.habitaciones}` : "") +
      `&orden=reciente`,
  },
  {
    id: "yaencontre",
    nombre: "Yaencontre",
    color: "#4E8098",
    url: (c) =>
      `https://www.yaencontre.com/alquiler/pisos/barcelona?maxPrice=${c.precioMax}` +
      (c.habitaciones ? `&minRooms=${c.habitaciones}` : "") +
      `&sort=date`,
  },
  {
    id: "spotahome",
    nombre: "Spotahome",
    color: "#C1502E",
    url: (c) => `https://www.spotahome.com/es/alquiler/barcelona/pisos?maxPrice=${c.precioMax}`,
  },
  {
    id: "rentumo",
    nombre: "Rentumo",
    color: "#1B5E7E",
    url: (c) =>
      `https://www.rentumo.es/?city=barcelona&price_max=${c.precioMax}` +
      (c.habitaciones ? `&rooms_min=${c.habitaciones}` : "") +
      `&sort=date`,
  },
  {
    id: "milanuncios",
    nombre: "Milanuncios",
    color: "#6B8F71",
    url: (c) =>
      `https://www.milanuncios.com/pisos-en-alquiler-en-barcelona/?precio_hasta=${c.precioMax}` +
      (c.habitaciones ? `&habitaciones_desde=${c.habitaciones}` : "") +
      `&orden=date`,
  },
];

/* ─── Vuestros criterios, guardados en el móvil ─────────────── */

const CLAVE = "ra_bcn_criterios";

export function leerCriterios(): Criterios {
  if (typeof window === "undefined") return CRITERIOS_POR_DEFECTO;
  try {
    const guardado = localStorage.getItem(CLAVE);
    return guardado
      ? { ...CRITERIOS_POR_DEFECTO, ...(JSON.parse(guardado) as Partial<Criterios>) }
      : CRITERIOS_POR_DEFECTO;
  } catch {
    return CRITERIOS_POR_DEFECTO;
  }
}

export function guardarCriterios(c: Criterios) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    /* si el navegador no deja guardar, se usan los de por defecto */
  }
}
