// ============================================================
// R&A — Proyecto Barcelona · Acceso a datos
// ============================================================

import { supabase } from "../supabase";
import type {
  Etapa, Barrio, Momento, Piso, Valoracion, Contacto,
  EntidadValorable, Usuario, EstadoMomento,
} from "./types";

// ─── Etapa ───────────────────────────────────────────────────

export async function getEtapaActiva(): Promise<Etapa | null> {
  const { data } = await supabase
    .from("bcn_etapas")
    .select("*")
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Etapa) ?? null;
}

export async function updateEtapa(id: string, cambios: Partial<Etapa>): Promise<boolean> {
  const { error } = await supabase.from("bcn_etapas").update(cambios).eq("id", id);
  return !error;
}

// ─── Barrios ─────────────────────────────────────────────────

export async function getBarrios(etapaId: string): Promise<Barrio[]> {
  const { data } = await supabase
    .from("bcn_barrios")
    .select("*")
    .eq("etapa_id", etapaId)
    .order("orden");
  return (data ?? []) as Barrio[];
}

export async function addBarrio(etapaId: string, barrio: Partial<Barrio>): Promise<Barrio | null> {
  const { data } = await supabase
    .from("bcn_barrios")
    .insert({ etapa_id: etapaId, ...barrio })
    .select()
    .single();
  return (data as Barrio) ?? null;
}

export async function updateBarrio(id: string, cambios: Partial<Barrio>): Promise<boolean> {
  const { error } = await supabase.from("bcn_barrios").update(cambios).eq("id", id);
  return !error;
}

// ─── Momentos ────────────────────────────────────────────────
// Una sola tabla, tres lecturas: agenda, historia y experiencias.

export async function getMomentos(etapaId: string): Promise<Momento[]> {
  const { data } = await supabase
    .from("bcn_momentos")
    .select("*")
    .eq("etapa_id", etapaId)
    .order("fecha", { ascending: false })
    .order("hora", { ascending: true, nullsFirst: true });
  return (data ?? []) as Momento[];
}

/** Lo que viene: de hoy en adelante, en orden cronológico ascendente. */
export async function getAgenda(etapaId: string): Promise<Momento[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("bcn_momentos")
    .select("*")
    .eq("etapa_id", etapaId)
    .eq("estado", "previsto")
    .gte("fecha", hoy)
    .order("fecha")
    .order("hora", { nullsFirst: true });
  return (data ?? []) as Momento[];
}

/** Lo vivido, del más reciente al más antiguo. */
export async function getHistoria(etapaId: string): Promise<Momento[]> {
  const { data } = await supabase
    .from("bcn_momentos")
    .select("*")
    .eq("etapa_id", etapaId)
    .eq("estado", "vivido")
    .order("fecha", { ascending: false })
    .order("hora", { ascending: false, nullsFirst: false });
  return (data ?? []) as Momento[];
}

export async function addMomento(etapaId: string, momento: Partial<Momento>): Promise<Momento | null> {
  const { data } = await supabase
    .from("bcn_momentos")
    .insert({ etapa_id: etapaId, ...momento })
    .select()
    .single();
  return (data as Momento) ?? null;
}

export async function updateMomento(id: string, cambios: Partial<Momento>): Promise<boolean> {
  const { error } = await supabase
    .from("bcn_momentos")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteMomento(id: string): Promise<boolean> {
  const { error } = await supabase.from("bcn_momentos").delete().eq("id", id);
  return !error;
}

/** Un plan de la agenda se convierte en recuerdo. */
export async function vivirMomento(id: string, nota?: string, fotos?: string[]): Promise<boolean> {
  return updateMomento(id, {
    estado: "vivido",
    ...(nota !== undefined ? { nota } : {}),
    ...(fotos !== undefined ? { fotos } : {}),
  });
}

// ─── Pisos ───────────────────────────────────────────────────

export async function getPisos(etapaId: string): Promise<Piso[]> {
  const { data } = await supabase
    .from("bcn_pisos")
    .select("*")
    .eq("etapa_id", etapaId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Piso[];
}

export async function addPiso(etapaId: string, piso: Partial<Piso>): Promise<Piso | null> {
  const { data } = await supabase
    .from("bcn_pisos")
    .insert({ etapa_id: etapaId, ...piso })
    .select()
    .single();
  return (data as Piso) ?? null;
}

export async function updatePiso(id: string, cambios: Partial<Piso>): Promise<boolean> {
  const { error } = await supabase
    .from("bcn_pisos")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deletePiso(id: string): Promise<boolean> {
  const { error } = await supabase.from("bcn_pisos").delete().eq("id", id);
  return !error;
}

// ─── Valoraciones (el motor de compatibilidad) ────────────────

export async function getValoraciones(
  etapaId: string,
  entidadTipo?: EntidadValorable
): Promise<Valoracion[]> {
  let q = supabase.from("bcn_valoraciones").select("*").eq("etapa_id", etapaId);
  if (entidadTipo) q = q.eq("entidad_tipo", entidadTipo);
  const { data } = await q;
  return (data ?? []) as Valoracion[];
}

export async function upsertValoracion(
  etapaId: string,
  entidadTipo: EntidadValorable,
  entidadId: string,
  usuario: Usuario,
  valores: { transporte?: number; ambiente?: number; precio?: number; sensacion?: number; nota?: string }
): Promise<boolean> {
  const { error } = await supabase.from("bcn_valoraciones").upsert(
    {
      etapa_id: etapaId,
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      usuario,
      ...valores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entidad_tipo,entidad_id,usuario" }
  );
  return !error;
}

// ─── Contactos ───────────────────────────────────────────────

export async function getContactos(etapaId: string): Promise<Contacto[]> {
  const { data } = await supabase
    .from("bcn_contactos")
    .select("*")
    .eq("etapa_id", etapaId)
    .order("favorito", { ascending: false })
    .order("nombre");
  return (data ?? []) as Contacto[];
}

export async function addContacto(etapaId: string, contacto: Partial<Contacto>): Promise<Contacto | null> {
  const { data } = await supabase
    .from("bcn_contactos")
    .insert({ etapa_id: etapaId, ...contacto })
    .select()
    .single();
  return (data as Contacto) ?? null;
}

export async function updateContacto(id: string, cambios: Partial<Contacto>): Promise<boolean> {
  const { error } = await supabase.from("bcn_contactos").update(cambios).eq("id", id);
  return !error;
}

export async function deleteContacto(id: string): Promise<boolean> {
  const { error } = await supabase.from("bcn_contactos").delete().eq("id", id);
  return !error;
}

// ─── Caché de IA ─────────────────────────────────────────────
// Evita regenerar texto en cada carga: solo si cambian los datos.

export interface CacheIA {
  contenido: string;
  datos_hash: string | null;
  created_at: string;
}

export async function getIA(etapaId: string, tipo: string, clave: string): Promise<CacheIA | null> {
  const { data } = await supabase
    .from("bcn_ia")
    .select("contenido, datos_hash, created_at")
    .eq("etapa_id", etapaId)
    .eq("tipo", tipo)
    .eq("clave", clave)
    .maybeSingle();
  return (data as CacheIA) ?? null;
}

export async function saveIA(
  etapaId: string,
  tipo: string,
  clave: string,
  contenido: string,
  datosHash: string
): Promise<boolean> {
  const { error } = await supabase.from("bcn_ia").upsert(
    { etapa_id: etapaId, tipo, clave, contenido, datos_hash: datosHash, created_at: new Date().toISOString() },
    { onConflict: "etapa_id,tipo,clave" }
  );
  return !error;
}

// ─── Snapshot ────────────────────────────────────────────────
// Todo lo que necesita la pantalla principal, en paralelo.

export interface Snapshot {
  etapa: Etapa;
  barrios: Barrio[];
  momentos: Momento[];
  pisos: Piso[];
  valoraciones: Valoracion[];
  contactos: Contacto[];
}

export async function getSnapshot(etapa: Etapa): Promise<Snapshot> {
  const [barrios, momentos, pisos, valoraciones, contactos] = await Promise.all([
    getBarrios(etapa.id),
    getMomentos(etapa.id),
    getPisos(etapa.id),
    getValoraciones(etapa.id),
    getContactos(etapa.id),
  ]);
  return { etapa, barrios, momentos, pisos, valoraciones, contactos };
}

// ─── Utilidades de fecha ─────────────────────────────────────

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Días desde la llegada. Negativo si aún no habéis llegado. */
export function diasEnCiudad(fechaLlegada: string | null): number | null {
  if (!fechaLlegada) return null;
  const llegada = new Date(fechaLlegada + "T00:00:00");
  const hoy = new Date(hoyISO() + "T00:00:00");
  return Math.round((hoy.getTime() - llegada.getTime()) / 86_400_000);
}

export function formatFechaLarga(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });
}

export function formatFechaCorta(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function nombreDia(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long" });
}

/** Clave de semana ISO, para cachear el resumen semanal: "2026-W32". */
export function claveSemana(d = new Date()): string {
  const fecha = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = fecha.getUTCDay() || 7;
  fecha.setUTCDate(fecha.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((fecha.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
  return `${fecha.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}
