// ============================================================
// R&A — Proyecto Barcelona · Tipos y vocabulario
// ============================================================

export type Usuario = "alejandro" | "rut";
export type Autor = Usuario | "ambos";

export type EstadoMomento = "previsto" | "vivido";

/**
 * El tipo de momento es texto libre: nadie sabe de antemano todo lo que
 * les va a pasar. Los de abajo son los que ya usan, y se ofrecen como
 * atajo para no teclear — pero pueden escribir el que quieran.
 */
export type TipoMomento = string;

export const TIPOS_SUGERIDOS = [
  "llegada",
  "visita_piso",
  "cita",
  "restaurante",
  "rooftop",
  "playa",
  "excursion",
  "explorar",
  "mudanza",
  "otro",
] as const;

export type EstadoPiso =
  | "nuevo"
  | "contactado"
  | "visitado"
  | "favorito"
  | "descartado"
  | "elegido";

/** Solo dos: o es alguien, o es un sitio donde trabaja alguien. */
export type TipoContacto = "persona" | "empresa";

export type EntidadValorable = "barrio" | "piso" | "experiencia";

// ─── Registros ───────────────────────────────────────────────

export interface Etapa {
  id: string;
  nombre: string;
  ciudad: string;
  subtitulo: string | null;
  fecha_llegada: string | null;
  fecha_mudanza: string | null;
  activa: boolean;
  created_at: string;
}

export interface Barrio {
  id: string;
  etapa_id: string;
  nombre: string;
  descripcion: string | null;
  lat: number | null;
  lng: number | null;
  color: string | null;
  visitado: boolean;
  orden: number;
  created_at: string;
}

export interface Momento {
  id: string;
  etapa_id: string;
  fecha: string;
  hora: string | null;
  estado: EstadoMomento;
  tipo: TipoMomento;
  titulo: string;
  nota: string | null;
  fotos: string[];
  lugar: string | null;
  lat: number | null;
  lng: number | null;
  barrio_id: string | null;
  piso_id: string | null;
  /** Con quién fue: la de la inmobiliaria, el casero, un amigo… */
  contacto_id: string | null;
  autor: Autor;
  es_hito: boolean;
  espontaneo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Piso {
  id: string;
  etapa_id: string;
  titulo: string;
  url: string | null;
  portal: string | null;
  portal_id: string | null;
  precio: number | null;
  gastos: number | null;
  m2: number | null;
  habitaciones: number | null;
  banos: number | null;
  planta: string | null;
  ascensor: boolean | null;
  amueblado: boolean | null;
  exterior: boolean | null;
  direccion: string | null;
  barrio_id: string | null;
  lat: number | null;
  lng: number | null;
  fotos: string[];
  descripcion: string | null;
  /** Quién os lo enseñó: la inmobiliaria, el casero, un amigo. */
  contacto_id: string | null;
  estado: EstadoPiso;
  motivo_descarte: string | null;
  datos_extra: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Valoracion {
  id: string;
  etapa_id: string;
  entidad_tipo: EntidadValorable;
  entidad_id: string;
  usuario: Usuario;
  transporte: number | null;
  ambiente: number | null;
  precio: number | null;
  sensacion: number | null;
  nota: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contacto {
  id: string;
  etapa_id: string;
  nombre: string;
  tipo: TipoContacto;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  favorito: boolean;
  created_at: string;
}

// ─── Vocabulario visual ──────────────────────────────────────

/** Paleta Barcelona: terracota, mar, arena y el dorado del atardecer. */
export const BCN = {
  teja:    "#C1502E",  // terracota de los tejados
  tejaOsc: "#8E3A20",
  mar:     "#1B5E7E",  // azul mediterráneo
  marClaro:"#4E8098",
  arena:   "#F7F0E6",  // crema de las fachadas
  arenaOsc:"#E5D9C8",
  oliva:   "#6B8F71",  // los plátanos de las ramblas
  sol:     "#E8A33D",  // el atardecer sobre Montjuïc
  noche:   "#23303B",
  tinta:   "#2C2420",
  humo:    "#8A7F76",
} as const;

/** Los 4 ejes de valoración. Pocos, para que se rellenen de verdad. */
export const EJES = [
  { key: "transporte", label: "Transporte", icon: "🚇" },
  { key: "ambiente",   label: "Ambiente",   icon: "🏡" },
  { key: "precio",     label: "Precio",     icon: "💰" },
  { key: "sensacion",  label: "Sensación",  icon: "❤️" },
] as const;

export type EjeKey = (typeof EJES)[number]["key"];

export const TIPO_MOMENTO: Record<string, { label: string; icon: string; color: string }> = {
  llegada:     { label: "Llegada",       icon: "✈️", color: BCN.sol },
  visita_piso: { label: "Visita piso",   icon: "🏠", color: BCN.teja },
  cita:        { label: "Cita",          icon: "📌", color: BCN.mar },
  restaurante: { label: "Restaurante",   icon: "🍽️", color: BCN.tejaOsc },
  rooftop:     { label: "Rooftop",       icon: "🌆", color: BCN.sol },
  playa:       { label: "Playa",         icon: "🏖️", color: BCN.marClaro },
  excursion:   { label: "Excursión",     icon: "🚆", color: BCN.oliva },
  explorar:    { label: "Explorar",      icon: "🚶", color: BCN.oliva },
  mudanza:     { label: "Mudanza",       icon: "📦", color: BCN.teja },
  otro:        { label: "Momento",       icon: "✨", color: BCN.humo },
};

/** Palabras que delatan de qué va un momento escrito a mano. */
const PISTAS: [RegExp, string][] = [
  [/piso|vivienda|casa|visita/i, "visita_piso"],
  [/come|cena|restaurant|tapa|brunch|desayun/i, "restaurante"],
  [/playa|mar\b|baño/i, "playa"],
  [/terraza|rooftop|azotea|atardecer/i, "rooftop"],
  [/tren|excursi|viaje|montserrat|sitges/i, "excursion"],
  [/mudanza|caja|mudar/i, "mudanza"],
  [/cita|reuni|firma|notar[íi]a|banco|gestor/i, "cita"],
  [/pasea|explora|barrio|ruta|descubr/i, "explorar"],
  [/vuelo|avi[óo]n|llega|aterriza/i, "llegada"],
];

/**
 * Cómo pintar un momento. Si el tipo es de los de siempre, su icono;
 * si lo escribieron ellos, buscamos una pista en las palabras y, si no
 * la hay, se queda con la estrella.
 */
export function pintarMomento(tipo: string, titulo = ""): { label: string; icon: string; color: string } {
  const conocido = TIPO_MOMENTO[tipo];
  if (conocido) return conocido;

  const texto = `${tipo} ${titulo}`;
  for (const [patron, clave] of PISTAS) {
    if (patron.test(texto)) return { ...TIPO_MOMENTO[clave], label: tipo };
  }
  return { label: tipo || "Momento", icon: "✨", color: BCN.humo };
}


export const ESTADO_PISO: Record<EstadoPiso, { label: string; icon: string; color: string }> = {
  nuevo:      { label: "Nuevo",      icon: "🆕", color: BCN.humo },
  contactado: { label: "Contactado", icon: "📞", color: BCN.mar },
  visitado:   { label: "Visitado",   icon: "👀", color: BCN.oliva },
  favorito:   { label: "Favorito",   icon: "❤️", color: BCN.teja },
  descartado: { label: "Descartado", icon: "✕",  color: BCN.humo },
  elegido:    { label: "¡Elegido!",  icon: "🔑", color: BCN.sol },
};

export const TIPO_CONTACTO: Record<TipoContacto, { label: string; plural: string; icon: string }> = {
  persona: { label: "Persona", plural: "Personas", icon: "👤" },
  empresa: { label: "Empresa", plural: "Empresas", icon: "🏢" },
};

/**
 * El color del círculo de un contacto, sacado de su propio nombre: así
 * cada uno tiene siempre el mismo y la lista se reconoce de un vistazo.
 */
const COLORES_INICIAL = [BCN.teja, BCN.mar, BCN.oliva, BCN.sol, BCN.tejaOsc, BCN.marClaro];

export function colorDeContacto(nombre: string): string {
  let suma = 0;
  for (let i = 0; i < nombre.length; i++) suma = (suma + nombre.charCodeAt(i)) % 997;
  return COLORES_INICIAL[suma % COLORES_INICIAL.length];
}

/** La letra que va dentro del círculo. */
export function inicialDe(nombre: string): string {
  const limpio = nombre.trim();
  if (!limpio) return "?";
  const letra = limpio[0].toUpperCase();
  return /[A-ZÁÉÍÓÚÑÀÈÌÒÙÇ0-9]/.test(letra) ? letra : "#";
}
