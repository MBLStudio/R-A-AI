// ============================================================
// R&A — Proyecto Barcelona · Tipos y vocabulario
// ============================================================

export type Usuario = "alejandro" | "rut";
export type Autor = Usuario | "ambos";

export type EstadoMomento = "previsto" | "vivido";

export type TipoMomento =
  | "llegada"
  | "visita_piso"
  | "cita"
  | "restaurante"
  | "rooftop"
  | "playa"
  | "excursion"
  | "explorar"
  | "mudanza"
  | "otro";

export type EstadoPiso =
  | "nuevo"
  | "contactado"
  | "visitado"
  | "favorito"
  | "descartado"
  | "elegido";

export type TipoContacto =
  | "inmobiliaria"
  | "propietario"
  | "empresa"
  | "amigo"
  | "conocido"
  | "otro";

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

export const TIPO_MOMENTO: Record<TipoMomento, { label: string; icon: string; color: string }> = {
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

/** Tipos que además cuentan como "experiencia" (tienen lugar y recuerdo). */
export const TIPOS_EXPERIENCIA: TipoMomento[] = [
  "restaurante", "rooftop", "playa", "excursion", "explorar",
];

export const ESTADO_PISO: Record<EstadoPiso, { label: string; icon: string; color: string }> = {
  nuevo:      { label: "Nuevo",      icon: "🆕", color: BCN.humo },
  contactado: { label: "Contactado", icon: "📞", color: BCN.mar },
  visitado:   { label: "Visitado",   icon: "👀", color: BCN.oliva },
  favorito:   { label: "Favorito",   icon: "❤️", color: BCN.teja },
  descartado: { label: "Descartado", icon: "✕",  color: BCN.humo },
  elegido:    { label: "¡Elegido!",  icon: "🔑", color: BCN.sol },
};

export const TIPO_CONTACTO: Record<TipoContacto, { label: string; icon: string }> = {
  inmobiliaria: { label: "Inmobiliaria", icon: "🏢" },
  propietario:  { label: "Propietario",  icon: "🔑" },
  empresa:      { label: "Empresa",      icon: "💼" },
  amigo:        { label: "Amigo",        icon: "🫂" },
  conocido:     { label: "Conocido",     icon: "👋" },
  otro:         { label: "Contacto",     icon: "📇" },
};
