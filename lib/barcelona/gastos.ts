// ============================================================
// R&A · Barcelona — Gastos
//
// Dos formas de pagar que conviven:
//
//   · Del BOTE     → la caja común. Es de los dos, a medias.
//   · Del BOLSILLO → lo adelanta uno, y queda apuntado quién.
//
// El saldo del bote nunca se guarda: se calcula sumando lo que
// habéis metido y restando lo que ha salido. Así no hay manera
// de que el número y los apuntes se lleven la contraria.
// ============================================================

import { supabase } from "@/lib/supabase";
import { BCN } from "./types";

export type FormaPago = "bote" | "alejandro" | "rut";
export type TipoGasto = "gasto" | "aportacion";
/** Con qué se pagó. Sin más pretensión que tenerlo apuntado. */
export type Medio = "efectivo" | "tarjeta" | null;

export interface Bote {
  id: string;
  etapa_id: string;
  nombre: string;
  color: string;
  objetivo: number | null;
  orden: number;
  archivado: boolean;
  created_at: string;
}

export interface Gasto {
  id: string;
  etapa_id: string;
  fecha: string;
  concepto: string;
  importe: number;
  tipo: TipoGasto;
  pagado_por: FormaPago;
  bote_id: string | null;
  /** Cosa suya, con su dinero: no entra en el reparto. */
  personal: boolean;
  medio: Medio;
  categoria: string;
  ticket_url: string | null;
  nota: string | null;
  fijo_id: string | null;
  fijo_periodo: string | null;
  created_at: string;
}

export interface GastoFijo {
  id: string;
  etapa_id: string;
  concepto: string;
  importe: number;
  dia: number;
  pagado_por: FormaPago;
  bote_id: string | null;
  personal: boolean;
  medio: Medio;
  categoria: string;
  activo: boolean;
  desde: string;
  created_at: string;
}

/* ─── Categorías ───────────────────────────────────────────── */

export const CATEGORIAS: Record<string, { label: string; icon: string; color: string }> = {
  casa:       { label: "Casa",        icon: "🏠", color: BCN.teja },
  comida:     { label: "Comida",      icon: "🛒", color: BCN.oliva },
  restaurante:{ label: "Restaurante", icon: "🍽️", color: BCN.tejaOsc },
  transporte: { label: "Transporte",  icon: "🚇", color: BCN.mar },
  ocio:       { label: "Ocio",        icon: "🎟️", color: BCN.sol },
  mudanza:    { label: "Mudanza",     icon: "📦", color: BCN.marClaro },
  otros:      { label: "Otros",       icon: "💫", color: BCN.humo },
};

export function categoria(clave: string) {
  return CATEGORIAS[clave] ?? CATEGORIAS.otros;
}

/** Un importe tal y como se escribe aquí: 1.234,50 € */
export function euros(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/** Sin decimales, para los titulares. */
export function eurosCorto(n: number): string {
  return Math.round(n).toLocaleString("es-ES") + " €";
}

/* ─── Consultas ────────────────────────────────────────────── */

export async function getBotes(etapaId: string): Promise<Bote[]> {
  const { data } = await supabase
    .from("bcn_botes").select("*")
    .eq("etapa_id", etapaId).eq("archivado", false)
    .order("orden").order("created_at");
  return (data ?? []) as Bote[];
}

export async function addBote(etapaId: string, bote: Partial<Bote>): Promise<Bote | null> {
  const { data } = await supabase
    .from("bcn_botes").insert({ etapa_id: etapaId, ...bote }).select().single();
  return (data as Bote) ?? null;
}

export async function updateBote(id: string, cambios: Partial<Bote>): Promise<boolean> {
  const { error } = await supabase.from("bcn_botes").update(cambios).eq("id", id);
  return !error;
}

export async function getGastos(etapaId: string): Promise<Gasto[]> {
  const { data } = await supabase
    .from("bcn_gastos").select("*")
    .eq("etapa_id", etapaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Gasto[];
}

export async function addGasto(etapaId: string, gasto: Partial<Gasto>): Promise<Gasto | null> {
  const { data } = await supabase
    .from("bcn_gastos").insert({ etapa_id: etapaId, ...gasto }).select().single();
  return (data as Gasto) ?? null;
}

export async function updateGasto(id: string, cambios: Partial<Gasto>): Promise<boolean> {
  const { error } = await supabase
    .from("bcn_gastos").update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function deleteGasto(id: string): Promise<boolean> {
  const { error } = await supabase.from("bcn_gastos").delete().eq("id", id);
  return !error;
}

export async function getFijos(etapaId: string): Promise<GastoFijo[]> {
  const { data } = await supabase
    .from("bcn_gastos_fijos").select("*")
    .eq("etapa_id", etapaId)
    .order("dia");
  return (data ?? []) as GastoFijo[];
}

export async function addFijo(etapaId: string, fijo: Partial<GastoFijo>): Promise<GastoFijo | null> {
  const { data } = await supabase
    .from("bcn_gastos_fijos").insert({ etapa_id: etapaId, ...fijo }).select().single();
  return (data as GastoFijo) ?? null;
}

export async function updateFijo(id: string, cambios: Partial<GastoFijo>): Promise<boolean> {
  const { error } = await supabase
    .from("bcn_gastos_fijos").update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function deleteFijo(id: string): Promise<boolean> {
  const { error } = await supabase.from("bcn_gastos_fijos").delete().eq("id", id);
  return !error;
}

/* ─── Los fijos, que se apuntan solos ──────────────────────── */

/**
 * Apunta los gastos fijos que ya tocaban y todavía no están.
 *
 * Se llama al abrir la pantalla en vez de con una tarea programada:
 * no hace falta un servidor despierto, y el resultado es el mismo
 * porque nadie mira sus gastos sin abrir la app.
 *
 * Mira los últimos meses por si habéis estado sin entrar, y el
 * índice único de la base de datos impide que se duplique nada
 * aunque entréis los dos a la vez.
 */
export async function apuntarFijosPendientes(
  etapaId: string,
  fijos: GastoFijo[],
  yaApuntados: Gasto[]
): Promise<number> {
  const hoy = new Date();
  const hechos = new Set(
    yaApuntados.filter((g) => g.fijo_id).map((g) => `${g.fijo_id}·${g.fijo_periodo}`)
  );

  const pendientes: Record<string, unknown>[] = [];

  for (const fijo of fijos) {
    if (!fijo.activo) continue;

    // Hasta seis meses atrás: suficiente para cubrir un olvido largo
    for (let atras = 0; atras < 6; atras++) {
      const mes = new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
      const periodo = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}`;
      if (hechos.has(`${fijo.id}·${periodo}`)) continue;

      // El día 31 en un mes de 30 se cobra el último día
      const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
      const dia = Math.min(fijo.dia, ultimoDia);
      const fecha = `${periodo}-${String(dia).padStart(2, "0")}`;

      // Ni antes de darlo de alta, ni en el futuro
      if (fecha < fijo.desde) continue;
      if (new Date(fecha + "T23:59:59") > hoy) continue;

      pendientes.push({
        etapa_id: etapaId,
        fecha,
        concepto: fijo.concepto,
        importe: fijo.importe,
        tipo: "gasto",
        pagado_por: fijo.pagado_por,
        bote_id: fijo.bote_id,
        personal: fijo.personal,
        medio: fijo.medio,
        categoria: fijo.categoria,
        fijo_id: fijo.id,
        fijo_periodo: periodo,
      });
    }
  }

  if (pendientes.length === 0) return 0;

  // Si otro dispositivo se nos adelantó, el índice único lo rechaza:
  // no pasa nada, es justo lo que queremos.
  const { error } = await supabase.from("bcn_gastos").insert(pendientes);
  return error ? 0 : pendientes.length;
}

/* ─── Las cuentas ──────────────────────────────────────────── */

/** Lo que queda en un bote: lo que entró menos lo que salió. */
export function saldoDelBote(gastos: Gasto[], boteId: string): number {
  return gastos
    .filter((g) => g.bote_id === boteId)
    .reduce((total, g) => total + (g.tipo === "aportacion" ? g.importe : -g.importe), 0);
}

export interface Balance {
  /** Lo que ha metido cada uno en los botes. */
  aportado: { alejandro: number; rut: number };
  /** Lo que ha adelantado cada uno de su bolsillo, por los dos. */
  bolsillo: { alejandro: number; rut: number };
  /** Lo que se ha gastado cada uno en sus cosas. No entra en el reparto. */
  personal: { alejandro: number; rut: number };
  /** La suma de las dos cosas. */
  total: { alejandro: number; rut: number };
  /** Cuánto ha puesto de más quien más ha puesto. */
  diferencia: number;
  /**
   * Lo que uno le daría al otro para quedar en paz: la mitad de la
   * diferencia, no la diferencia entera. Si uno puso 620 y el otro 460,
   * entre los dos han puesto 1.080 y a cada uno le tocaban 540: el que
   * va corto debe 80, no 160. Es el error clásico al repartir gastos.
   */
  deuda: number;
  /** Quién va por delante, o null si están igualados. */
  quienVaDelante: "alejandro" | "rut" | null;
}

/**
 * Quién ha puesto qué.
 *
 * Lo del bote no entra en la cuenta —eso ya es de los dos—, pero sí
 * lo que cada uno metió en él y lo que ha adelantado por su cuenta.
 */
export function calcularBalance(gastos: Gasto[]): Balance {
  const balance: Balance = {
    aportado: { alejandro: 0, rut: 0 },
    bolsillo: { alejandro: 0, rut: 0 },
    personal: { alejandro: 0, rut: 0 },
    total: { alejandro: 0, rut: 0 },
    diferencia: 0,
    deuda: 0,
    quienVaDelante: null,
  };

  for (const g of gastos) {
    if (g.pagado_por !== "alejandro" && g.pagado_por !== "rut") continue;
    const quien = g.pagado_por;

    if (g.tipo === "aportacion") {
      balance.aportado[quien] += g.importe;
    } else if (g.personal) {
      // Sus zapatillas con su dinero: se apunta para saberlo, pero
      // nadie le debe nada a nadie por ellas.
      balance.personal[quien] += g.importe;
    } else {
      balance.bolsillo[quien] += g.importe;
    }
  }

  balance.total.alejandro = balance.aportado.alejandro + balance.bolsillo.alejandro;
  balance.total.rut = balance.aportado.rut + balance.bolsillo.rut;

  const hueco = balance.total.alejandro - balance.total.rut;
  balance.diferencia = Math.abs(hueco);
  balance.deuda = balance.diferencia / 2;
  // Menos de un euro de diferencia es estar en paz
  balance.quienVaDelante = balance.diferencia < 1 ? null : hueco > 0 ? "alejandro" : "rut";

  return balance;
}

/** En qué se os va el dinero común, de más a menos. */
export function porCategoria(gastos: Gasto[]): { clave: string; total: number }[] {
  const suma: Record<string, number> = {};
  for (const g of gastos) {
    if (g.tipo !== "gasto" || g.personal) continue;
    suma[g.categoria] = (suma[g.categoria] ?? 0) + g.importe;
  }
  return Object.entries(suma)
    .map(([clave, total]) => ({ clave, total }))
    .sort((a, b) => b.total - a.total);
}

/** Los meses que tienen algo apuntado, del más nuevo al más viejo. */
export function mesesConMovimiento(gastos: Gasto[]): string[] {
  const meses = new Set(gastos.map((g) => g.fecha.slice(0, 7)));
  const ahora = new Date();
  // El mes en curso siempre está, aunque todavía no haya nada
  meses.add(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`);
  return [...meses].sort().reverse();
}

/** Cómo se escribe un mes: «agosto de 2026». */
export function nombreDelMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const texto = new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function delMes(gastos: Gasto[], mes: string): Gasto[] {
  return gastos.filter((g) => g.fecha.startsWith(mes));
}

/** Lo gastado este mes, para el titular. */
export function gastadoEsteMes(gastos: Gasto[]): number {
  const ahora = new Date();
  const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  return gastos
    .filter((g) => g.tipo === "gasto" && !g.personal && g.fecha.startsWith(mes))
    .reduce((t, g) => t + g.importe, 0);
}
