import { supabase } from "./supabase";

/**
 * La "Sorpresa": una carta única que Alejandro prepara para Rut.
 * Solo hay un registro (id = "principal").
 * La carta es el frente; al girarla se descubren las fotos del tatuaje.
 */
export interface Sorpresa {
  id: string;
  titulo: string;
  cuerpo: string;
  firma_nombre: string;
  firma_url: string | null;   // firma dibujada (PNG transparente)
  firma_at: string | null;
  fotos: string[];            // fotos del tatuaje (el reverso)
  foto_caption: string;
  revelada: boolean;
  revelada_at: string | null;
  abierta_at: string | null;  // cuándo la abrió Rut por primera vez
  updated_at: string;
}

export const SORPRESA_ID = "principal";

export const SORPRESA_VACIA: Sorpresa = {
  id: SORPRESA_ID,
  titulo: "",
  cuerpo: "",
  firma_nombre: "",
  firma_url: null,
  firma_at: null,
  fotos: [],
  foto_caption: "",
  revelada: false,
  revelada_at: null,
  abierta_at: null,
  updated_at: "",
};

/**
 * Texto de la carta, precargado en el editor de Alejandro.
 * Fuente única: se rellena aquí, él lo revisa y pulsa Guardar.
 * (Verbatim — no corregir "quimo", "porfin", etc.: son suyos.)
 */
export const CARTA_RUT = {
  titulo: "Para Rut",
  firma_nombre: "Tuyo, Alejandro",
  cuerpo: `Se que estamos atravesando un momento dificil, creo que estamos volviendo a una etapa que me parece preciosa y la verdad es que poco a poco te siento tal y como éramos pero de manera aún más bonita ya que me está encantando conocerte por segunda vez

Me encanta la nueva aventura en la que nos vamos a abarcar, aunque la empecemos por separado la vida nos juntará para seguir con ella en el mismo sentido

La verdad es que nunca he querido a alguien como te he querido a ti y tengo mucha suerte de tenerte a mi lado, también tengo ganas de comerme el mundo contigo de mi mano y me encantaría que las palabras del amor de mi vida fueran verdad durante toda la vida

Sé que dirás, porque estás haciendo esta carta, pero la verdad es que esto lleva algo más de significado, quiero que sea algo bonito ya que para mí lo es y que pienses en lo muchísimo que te quiero, no he sido el mejor en muchos aspectos, no he sido la persona con la que compartirías la vida de tus sueños pero sí que me estoy esforzando todos los días para que llegues a ver lo que de verdad quiero ser para estar a tu lado durante toda la vida

Ya no me enrollo más y te quiero decir que te quimo, pero ahora no es solo decirlo, ahora es sentirlo de verdad, llevaba mucho tiempo queriendo pero porfin he tenido la suerte de tener un hueco para llevarlo a cabo, por hoy y por siempre… 🧡TE QUIMO🧡`,
};

export async function loadSorpresa(): Promise<Sorpresa | null> {
  const { data, error } = await supabase
    .from("sorpresa")
    .select("*")
    .eq("id", SORPRESA_ID)
    .maybeSingle();
  if (error) return null;
  return data ?? null;
}

export async function saveSorpresa(
  fields: Partial<Omit<Sorpresa, "id" | "updated_at">>
): Promise<Sorpresa | null> {
  const { data, error } = await supabase
    .from("sorpresa")
    .upsert(
      { id: SORPRESA_ID, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error || !data) return null;
  return data;
}

/** Marca la sorpresa como abierta por Rut (solo la primera vez). */
export async function marcarSorpresaAbierta(): Promise<void> {
  await supabase
    .from("sorpresa")
    .update({ abierta_at: new Date().toISOString() })
    .eq("id", SORPRESA_ID)
    .is("abierta_at", null);
}

export function fmtFechaLarga(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}
