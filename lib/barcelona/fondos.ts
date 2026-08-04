// ============================================================
// R&A — Fondos de la cabecera de Barcelona
//
// Rotan solos: cada día toca una. Se puede fijar la favorita
// para que no cambie, y añadir fotos propias.
//
// Las de serie vienen de Wikimedia Commons (CC BY-SA) y están
// alojadas en /public/barcelona, así que no dependen de nadie.
// ============================================================

export interface Fondo {
  id: string;
  url: string;
  titulo: string;
  /** Dónde enfocar el recorte cuando la foto no cabe entera. */
  posicion: string;
  propia?: boolean;
}

export const FONDOS: Fondo[] = [
  {
    id: "bunkers",
    url: "/barcelona/01-bunkers-amanecer.jpg",
    titulo: "Amanecer desde los Búnkers del Carmel",
    posicion: "center 42%",
  },
  {
    id: "guinardo",
    url: "/barcelona/02-guinardo-atardecer.jpg",
    titulo: "Atardecer sobre la ciudad",
    posicion: "center 55%",
  },
  {
    id: "aerea",
    url: "/barcelona/03-aerea-puerto.jpg",
    titulo: "El puerto y el Tibidabo",
    posicion: "center 45%",
  },
  {
    id: "guell",
    url: "/barcelona/04-park-guell.jpg",
    titulo: "La ciudad desde Park Güell",
    posicion: "center 62%",
  },
  {
    id: "barceloneta",
    url: "/barcelona/05-barceloneta.jpg",
    titulo: "Paseo marítimo de la Barceloneta",
    posicion: "center 50%",
  },
];

const CLAVE_FIJADA = "ra_bcn_fondo_fijado";
const CLAVE_PROPIAS = "ra_bcn_fondos_propios";

/** Día del año: hace que la rotación sea la misma para los dos. */
function diaDelAno(): number {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), 0, 0);
  return Math.floor((hoy.getTime() - inicio.getTime()) / 86_400_000);
}

/** Fotos que habéis subido vosotros. */
export function fondosPropios(): Fondo[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PROPIAS) ?? "[]") as Fondo[];
  } catch {
    return [];
  }
}

export function guardarFondoPropio(url: string, posicion: string): Fondo {
  const nuevo: Fondo = {
    id: `propia-${Date.now().toString(36)}`,
    url,
    titulo: "Vuestra foto",
    posicion,
    propia: true,
  };
  const todos = [...fondosPropios(), nuevo];
  localStorage.setItem(CLAVE_PROPIAS, JSON.stringify(todos));
  return nuevo;
}

export function borrarFondoPropio(id: string) {
  localStorage.setItem(
    CLAVE_PROPIAS,
    JSON.stringify(fondosPropios().filter((f) => f.id !== id))
  );
  if (fondoFijado() === id) fijarFondo(null);
}

export function todosLosFondos(): Fondo[] {
  return [...FONDOS, ...fondosPropios()];
}

export function fondoFijado(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CLAVE_FIJADA);
}

export function fijarFondo(id: string | null) {
  if (id) localStorage.setItem(CLAVE_FIJADA, id);
  else localStorage.removeItem(CLAVE_FIJADA);
}

/** La de hoy: la fijada si la hay, si no la que toque por fecha. */
export function fondoDeHoy(): Fondo {
  const todos = todosLosFondos();
  const fijado = fondoFijado();
  if (fijado) {
    const f = todos.find((x) => x.id === fijado);
    if (f) return f;
  }
  return todos[diaDelAno() % todos.length];
}
