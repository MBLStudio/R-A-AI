// ============================================================
// R&A — La foto de la cabecera de Barcelona
//
// Rotan solas: cada día toca una. Se puede fijar la favorita
// para que no cambie, y añadir fotos vuestras.
//
// Antes esto vivía en el navegador de cada uno, así que la foto
// que ponía uno el otro no la veía nunca. Ahora se guarda con
// la etapa: es de los dos, como todo lo demás.
//
// Las de serie vienen de Wikimedia Commons (CC BY-SA) y están
// alojadas en /public/barcelona, así que no dependen de nadie.
// ============================================================

import { supabase } from "@/lib/supabase";

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

/** Lo que hay guardado en la etapa sobre la cabecera. */
export interface AjusteFondo {
  fijado: string | null;
  posicionFijada: string | null;
  propias: Fondo[];
}

const VACIO: AjusteFondo = { fijado: null, posicionFijada: null, propias: [] };

/** Día del año: hace que la rotación sea la misma para los dos. */
function diaDelAno(): number {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), 0, 0);
  return Math.floor((hoy.getTime() - inicio.getTime()) / 86_400_000);
}

/* ─── Leer y escribir ──────────────────────────────────────── */

export async function leerAjuste(etapaId: string): Promise<AjusteFondo> {
  const { data } = await supabase
    .from("bcn_etapas")
    .select("fondo_url, fondo_posicion, fondos_propios")
    .eq("id", etapaId)
    .maybeSingle();

  if (!data) return VACIO;
  return {
    fijado: (data.fondo_url as string) ?? null,
    posicionFijada: (data.fondo_posicion as string) ?? null,
    propias: Array.isArray(data.fondos_propios) ? (data.fondos_propios as Fondo[]) : [],
  };
}

/** Fijar una foto, o soltar el pin pasando null. */
export async function fijarFondo(etapaId: string, url: string | null, posicion: string | null) {
  await supabase
    .from("bcn_etapas")
    .update({ fondo_url: url, fondo_posicion: posicion })
    .eq("id", etapaId);
}

export async function guardarFondoPropio(
  etapaId: string,
  propias: Fondo[],
  url: string,
  posicion: string
): Promise<Fondo> {
  const nuevo: Fondo = {
    id: `propia-${Date.now().toString(36)}`,
    url,
    titulo: "Vuestra foto",
    posicion,
    propia: true,
  };
  await supabase
    .from("bcn_etapas")
    .update({ fondos_propios: [...propias, nuevo] })
    .eq("id", etapaId);
  return nuevo;
}

export async function borrarFondoPropio(etapaId: string, propias: Fondo[], id: string) {
  const quedan = propias.filter((f) => f.id !== id);
  const borrada = propias.find((f) => f.id === id);
  const cambios: Record<string, unknown> = { fondos_propios: quedan };

  // Si la que se borra era la fijada, se suelta el pin
  if (borrada) {
    const { data } = await supabase
      .from("bcn_etapas").select("fondo_url").eq("id", etapaId).maybeSingle();
    if (data?.fondo_url === borrada.url) {
      cambios.fondo_url = null;
      cambios.fondo_posicion = null;
    }
  }

  await supabase.from("bcn_etapas").update(cambios).eq("id", etapaId);
}

/* ─── Cuál toca ────────────────────────────────────────────── */

export function todosLosFondos(propias: Fondo[]): Fondo[] {
  return [...FONDOS, ...propias];
}

/** La de hoy: la fijada si la hay, si no la que toque por fecha. */
export function fondoDeHoy(ajuste: AjusteFondo): Fondo {
  const todos = todosLosFondos(ajuste.propias);

  if (ajuste.fijado) {
    const f = todos.find((x) => x.url === ajuste.fijado);
    if (f) return ajuste.posicionFijada ? { ...f, posicion: ajuste.posicionFijada } : f;
    // Una foto fijada que ya no está en la lista: se usa igual
    return {
      id: "fijada",
      url: ajuste.fijado,
      titulo: "Vuestra foto",
      posicion: ajuste.posicionFijada ?? "center 50%",
      propia: true,
    };
  }

  return todos[diaDelAno() % todos.length];
}
