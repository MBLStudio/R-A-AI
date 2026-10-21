import { supabase } from "@/lib/supabase";
import { BCN } from "./types";

/* ═══════════════════════════════════════════════════════════
   Proyecto Barcelona — TRABAJO
   El horario de cada uno, semana a semana, y las ventas del día.

   Un día = una fila en trabajo_turnos, con sus tramos dentro.
   Los importes se suman en céntimos para que nunca se escape
   un 0,01 € por el camino.
   ═══════════════════════════════════════════════════════════ */

export type Persona = "alejandro" | "rut";
export type TipoDia = "trabajo" | "libre" | "vacaciones" | "festivo";

/** Un tramo del turno, en "HH:MM". */
export interface Tramo {
  inicio: string;
  fin: string;
}

export interface Turno {
  id: string;
  user_name: Persona;
  fecha: string;
  tipo: TipoDia;
  tramos: Tramo[];
  nota: string | null;
}

export interface Venta {
  id: string;
  user_name: Persona;
  fecha: string;
  hora: string;
  nombre: string;
  precio: number;
  nota: string | null;
  created_at: string;
}

/**
 * Quién tiene calendario aquí. Con más de uno aparece el selector
 * de persona; las ventas solo salen a quien las lleva (Rut, en tienda).
 */
export const PERSONAS: { id: Persona; nombre: string; ventas: boolean }[] = [
  { id: "rut", nombre: "Rut", ventas: true },
  { id: "alejandro", nombre: "Alejandro", ventas: false },
];

export const TIPO_DIA: Record<TipoDia, { label: string; icon: string; color: string }> = {
  trabajo:    { label: "Trabajo",    icon: "💼", color: BCN.mar },
  libre:      { label: "Libre",      icon: "☕", color: BCN.oliva },
  vacaciones: { label: "Vacaciones", icon: "🌴", color: BCN.sol },
  festivo:    { label: "Festivo",    icon: "🎉", color: BCN.tejaOsc },
};

/* ─── Fechas (siempre hora de Madrid) ──────────────────────── */

const ZONA = "Europe/Madrid";

/** Hoy en Madrid, como AAAA-MM-DD. */
export function hoyMadrid(): string {
  // en-CA escribe las fechas justo en ese formato
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** La hora de ahora en Madrid, "HH:MM". */
export function horaMadrid(): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date());
}

// Las cuentas de días se hacen en UTC puro: así un cambio de
// horario de verano nunca convierte un día en dos.
function aFecha(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

export function sumarDias(iso: string, n: number): string {
  const d = aFecha(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = lunes … 6 = domingo */
function indiceDia(iso: string): number {
  return (aFecha(iso).getUTCDay() + 6) % 7;
}

export function lunesDe(iso: string): string {
  return sumarDias(iso, -indiceDia(iso));
}

export function diasDeSemana(lunes: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function diaCorto(iso: string): string {
  return DIAS[indiceDia(iso)];
}

export function numeroDia(iso: string): number {
  return aFecha(iso).getUTCDate();
}

/** "lun 21 oct" */
export function fechaCorta(iso: string): string {
  const d = aFecha(iso);
  return `${diaCorto(iso)} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** "Lunes 21 de octubre" */
export function fechaLarga(iso: string): string {
  const d = aFecha(iso);
  const texto = `${DIAS_LARGOS[indiceDia(iso)]} ${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "21 – 27 oct" o "28 oct – 3 nov" */
export function rangoSemana(lunes: string): string {
  const a = aFecha(lunes);
  const b = aFecha(sumarDias(lunes, 6));
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MESES[b.getUTCMonth()]}`;
  }
  return `${a.getUTCDate()} ${MESES[a.getUTCMonth()]} – ${b.getUTCDate()} ${MESES[b.getUTCMonth()]}`;
}

/** Primer y último día del mes de una fecha. */
export function limitesMes(iso: string): { desde: string; hasta: string; nombre: string } {
  const d = aFecha(iso);
  const desde = `${iso.slice(0, 7)}-01`;
  const siguiente = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const hasta = sumarDias(siguiente.toISOString().slice(0, 10), -1);
  const nombre = MESES_LARGOS[d.getUTCMonth()];
  return { desde, hasta, nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
}

/* ─── Horas ────────────────────────────────────────────────── */

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutosTramo(t: Tramo): number {
  return aMinutos(t.fin) - aMinutos(t.inicio);
}

/** Minutos trabajados en un día. Libre y vacaciones cuentan 0. */
export function minutosTurno(turno: Pick<Turno, "tipo" | "tramos"> | null | undefined): number {
  if (!turno || turno.tipo !== "trabajo") return 0;
  return turno.tramos.reduce((s, t) => s + Math.max(0, minutosTramo(t)), 0);
}

/** "8 h", "7 h 30 min", "45 min" */
export function textoHoras(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!m) return `${h} h`;
  if (!h) return `${m} min`;
  return `${h} h ${m} min`;
}

/** "10:00–14:00 · 17:00–21:00" */
export function textoTramos(tramos: Tramo[]): string {
  return tramos.map((t) => `${t.inicio}–${t.fin}`).join(" · ");
}

export function ordenarTramos(tramos: Tramo[]): Tramo[] {
  return [...tramos].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Devuelve el problema de los tramos, o null si están bien. */
export function revisarTramos(tramos: Tramo[]): string | null {
  if (tramos.length === 0) return "Añade al menos un tramo.";
  for (const t of tramos) {
    if (!t.inicio || !t.fin) return "Falta alguna hora.";
    if (minutosTramo(t) <= 0) return "La salida tiene que ser después de la entrada.";
  }
  const orden = ordenarTramos(tramos);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i].inicio < orden[i - 1].fin) return "Los tramos se pisan.";
  }
  return null;
}

/* ─── Dinero ───────────────────────────────────────────────── */

function aCentimos(n: number): number {
  return Math.round(Number(n) * 100);
}

/**
 * "1.234,50 €". A mano y no con toLocaleString: el formato es-ES
 * no pone el punto de los miles hasta las 5 cifras (1234,50).
 */
export function euros(n: number): string {
  const [entero, decimales] = Math.abs(n).toFixed(2).split(".");
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${conPuntos},${decimales} €`;
}

/** Lee "12", "12,5", "12.50" o "1.234,50". null si no es un precio. */
export function leerPrecio(texto: string): number | null {
  let t = texto.trim().replace(/\s|€/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(t)) t = t.replace(/\./g, ""); // "1.234" son miles
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return aCentimos(parseFloat(t)) / 100;
}

export function totalVentas(ventas: Venta[]): number {
  return ventas.reduce((s, v) => s + aCentimos(v.precio), 0) / 100;
}

export function resumenMes(ventas: Venta[]) {
  const centimos = ventas.reduce((s, v) => s + aCentimos(v.precio), 0);
  const porDia = new Map<string, number>();
  for (const v of ventas) porDia.set(v.fecha, (porDia.get(v.fecha) ?? 0) + aCentimos(v.precio));

  let mejor: { fecha: string; centimos: number } | null = null;
  for (const [fecha, c] of porDia) {
    if (!mejor || c > mejor.centimos) mejor = { fecha, centimos: c };
  }

  return {
    total: centimos / 100,
    n: ventas.length,
    ticketMedio: ventas.length ? Math.round(centimos / ventas.length) / 100 : 0,
    mejorDia: mejor ? { fecha: mejor.fecha, total: mejor.centimos / 100 } : null,
  };
}

/* ─── Consultas: turnos ────────────────────────────────────── */

export async function getTurnos(persona: Persona, desde: string, hasta: string): Promise<Turno[]> {
  const { data } = await supabase
    .from("trabajo_turnos").select("*")
    .eq("user_name", persona)
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha");
  return (data ?? []) as Turno[];
}

/** El siguiente día de trabajo después de una fecha. */
export async function getProximoTurno(persona: Persona, despuesDe: string): Promise<Turno | null> {
  const { data } = await supabase
    .from("trabajo_turnos").select("*")
    .eq("user_name", persona).eq("tipo", "trabajo")
    .gt("fecha", despuesDe)
    .order("fecha").limit(1).maybeSingle();
  return (data as Turno | null) ?? null;
}

export interface DatosDia {
  tipo: TipoDia;
  tramos: Tramo[];
  nota: string | null;
}

function fila(persona: Persona, fecha: string, d: DatosDia) {
  return {
    user_name: persona,
    fecha,
    tipo: d.tipo,
    tramos: d.tipo === "trabajo" ? ordenarTramos(d.tramos) : [],
    nota: d.nota?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export async function guardarTurno(persona: Persona, fecha: string, d: DatosDia): Promise<boolean> {
  const { error } = await supabase
    .from("trabajo_turnos")
    .upsert(fila(persona, fecha, d), { onConflict: "user_name,fecha" });
  return !error;
}

/** La semana entera de una vez: lo que se rellena se guarda, lo vaciado se borra. */
export async function guardarSemana(
  persona: Persona,
  dias: { fecha: string; datos: DatosDia }[],
  borrar: string[],
): Promise<boolean> {
  if (dias.length) {
    const { error } = await supabase
      .from("trabajo_turnos")
      .upsert(dias.map((d) => fila(persona, d.fecha, d.datos)), { onConflict: "user_name,fecha" });
    if (error) return false;
  }
  if (borrar.length) {
    const { error } = await supabase
      .from("trabajo_turnos").delete()
      .eq("user_name", persona).in("fecha", borrar);
    if (error) return false;
  }
  return true;
}

export async function borrarTurno(persona: Persona, fecha: string): Promise<boolean> {
  const { error } = await supabase
    .from("trabajo_turnos").delete()
    .eq("user_name", persona).eq("fecha", fecha);
  return !error;
}

/* ─── Consultas: ventas ────────────────────────────────────── */

export async function getVentas(persona: Persona, desde: string, hasta: string): Promise<Venta[]> {
  const { data } = await supabase
    .from("trabajo_ventas").select("*")
    .eq("user_name", persona)
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha").order("hora");
  // La base de datos devuelve la hora con segundos y el precio puede llegar como texto
  return ((data ?? []) as Venta[]).map((v) => ({ ...v, hora: v.hora.slice(0, 5), precio: Number(v.precio) }));
}

export interface DatosVenta {
  fecha: string;
  hora: string;
  nombre: string;
  precio: number;
  nota: string | null;
}

export async function guardarVenta(persona: Persona, d: DatosVenta, id?: string): Promise<boolean> {
  const fila = {
    user_name: persona,
    fecha: d.fecha,
    hora: d.hora,
    nombre: d.nombre.trim(),
    // Como texto: llega a NUMERIC sin pasar por un float
    precio: d.precio.toFixed(2),
    nota: d.nota?.trim() || null,
  };
  const { error } = id
    ? await supabase.from("trabajo_ventas").update(fila).eq("id", id)
    : await supabase.from("trabajo_ventas").insert(fila);
  return !error;
}

export async function borrarVenta(id: string): Promise<boolean> {
  const { error } = await supabase.from("trabajo_ventas").delete().eq("id", id);
  return !error;
}
