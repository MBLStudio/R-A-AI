import { supabase } from "@/lib/supabase";
import { BCN } from "./types";

/* ═══════════════════════════════════════════════════════════
   Proyecto Barcelona — SUPERMERCADO
   Recetario, menú de la semana, lista de la compra y nevera.

   El recetario es el centro: el menú apunta a recetas, la
   compra sale de sumar sus ingredientes y la nevera se llena
   al dar la compra por hecha.
   ═══════════════════════════════════════════════════════════ */

export type Seccion =
  | "fruta_verdura" | "carne_pescado" | "lacteos_huevos" | "panaderia"
  | "despensa" | "congelados" | "bebidas" | "drogueria" | "otros";

/** Unidades en las que la IA escribe las cantidades: así se pueden sumar. */
export type Unidad = "g" | "ml" | "ud" | "cda" | "cdta" | "pizca";

export interface Ingrediente {
  nombre: string;
  /** Para las raciones de la receta. 0 = al gusto. */
  cantidad: number;
  unidad: Unidad;
  seccion: Seccion;
}

export type Valoracion = "encanta" | "bien" | "nunca";
export type Dificultad = "facil" | "media" | "elaborada";
export type Momento = "comida" | "cena";

export interface Receta {
  id: string;
  nombre: string;
  descripcion: string | null;
  raciones: number;
  tiempo_min: number | null;
  dificultad: Dificultad | null;
  kcal_racion: number | null;
  proteinas_racion: number | null;
  hidratos_racion: number | null;
  grasas_racion: number | null;
  fibra_racion: number | null;
  ingredientes: Ingrediente[];
  pasos: string[];
  etiquetas: string[];
  origen: "ia" | "nuestra" | "enlace";
  enlace: string | null;
  foto_url: string | null;
  valoracion: Valoracion | null;
  nota: string | null;
  veces: number;
  ultima_vez: string | null;
  /** De los vuestros: la IA lo va poniendo en el menú a menudo. */
  fijo: boolean;
  /** Día de la semana preferido para un fijo (1 = lunes … 7 = domingo). */
  dia_fijo: number | null;
  creada_por: string | null;
  created_at: string;
}

/** Lo que devuelve la IA (o se escribe a mano) antes de guardarse. */
export type RecetaNueva = Pick<
  Receta,
  "nombre" | "descripcion" | "raciones" | "tiempo_min" | "dificultad" | "kcal_racion" |
  "proteinas_racion" | "hidratos_racion" | "grasas_racion" | "fibra_racion" |
  "ingredientes" | "pasos" | "etiquetas"
> & Partial<Pick<Receta, "origen" | "enlace" | "foto_url" | "nota" | "valoracion">>;

/** Un plato que propone la IA para un hueco: uno vuestro (receta_id) o uno nuevo (receta). */
export interface Propuesta {
  fecha: string;
  momento: Momento;
  receta_id: string | null;
  receta: RecetaNueva | null;
}

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Hueco {
  id: string;
  fecha: string;
  momento: Momento;
  receta_id: string | null;
  texto: string | null;
  raciones: number;
  hecho: boolean;
}

export interface ItemLista {
  id: string;
  nombre: string;
  cantidad: string | null;
  seccion: Seccion;
  comprado: boolean;
  origen: "manual" | "menu" | "receta";
  anadido_por: string | null;
  created_at: string;
}

export interface ItemNevera {
  id: string;
  nombre: string;
  cantidad: string | null;
  seccion: Seccion;
  caduca: string | null;
  created_at: string;
}

/* ─── Catálogos ────────────────────────────────────────────── */

/** En el orden en que se recorre un súper. */
export const SECCIONES: Record<Seccion, { label: string; icon: string; orden: number }> = {
  fruta_verdura:  { label: "Fruta y verdura",   icon: "🥬", orden: 1 },
  panaderia:      { label: "Panadería",         icon: "🥖", orden: 2 },
  carne_pescado:  { label: "Carne y pescado",   icon: "🐟", orden: 3 },
  lacteos_huevos: { label: "Lácteos y huevos",  icon: "🥚", orden: 4 },
  despensa:       { label: "Despensa",          icon: "🫙", orden: 5 },
  congelados:     { label: "Congelados",        icon: "🧊", orden: 6 },
  bebidas:        { label: "Bebidas",           icon: "🧃", orden: 7 },
  drogueria:      { label: "Droguería y casa",  icon: "🧴", orden: 8 },
  otros:          { label: "Otros",             icon: "🛒", orden: 9 },
};

export const LISTA_SECCIONES = Object.keys(SECCIONES) as Seccion[];

export const VALORACION: Record<Valoracion, { label: string; icon: string; color: string }> = {
  encanta: { label: "Nos encanta", icon: "❤️", color: BCN.teja },
  bien:    { label: "Bien",        icon: "👍", color: BCN.oliva },
  nunca:   { label: "Nunca más",   icon: "👎", color: BCN.humo },
};

export const MOMENTOS: Record<Momento, { label: string; icon: string }> = {
  comida: { label: "Comida", icon: "☀️" },
  cena:   { label: "Cena",   icon: "🌙" },
};

export const DIFICULTAD: Record<Dificultad, string> = {
  facil: "Fácil",
  media: "Media",
  elaborada: "Elaborada",
};

/** Lo que se adivina por el nombre, para lo que se apunta a mano. */
const PISTAS_SECCION: [RegExp, Seccion][] = [
  [/lej[ií]a|friegasuelos|detergente|suavizante|papel (higi[eé]nico|de cocina)|servilleta|bolsas? de basura|jab[oó]n|champ[uú]|gel |pasta de dientes|desodorante|esponja|estropajo|lavavajillas|compresa|tamp[oó]n|cepillo/i, "drogueria"],
  [/congelad|helado/i, "congelados"],
  // Antes que la fruta: "tomate frito" es de bote, no de la frutería
  [/tomate (frito|triturado|natural)|en conserva|en lata|cocid[oa]s?\b/i, "despensa"],
  [/\bagua\b|cerveza|vino|zumo|refresco|coca.?cola|caf[eé] (soluble|en grano)|kombucha|t[oó]nica|batido/i, "bebidas"],
  [/pan\b|barra|baguette|pan de molde|tostadas|picos|croissant|biscote|tortillas? de trigo|wrap/i, "panaderia"],
  [/leche|yogur|queso|mantequilla|nata|huevo|kefir|reques[oó]n|burrata|mozzarella|skyr/i, "lacteos_huevos"],
  [/pollo|pavo|ternera|cerdo|lomo|carne|jam[oó]n|chorizo|salchich|bacon|beicon|hamburguesa|merluza|salm[oó]n|at[uú]n fresco|bacalao|gambas?|langostino|mejill|calamar|sepia|pescado|lubina|dorada|sardina|boquer/i, "carne_pescado"],
  [/manzana|pl[aá]tano|naranja|mandarina|pera|uva|fresa|kiwi|lim[oó]n|lima|mango|pi[ñn]a|aguacate|tomate|lechuga|cebolla|ajo|pimiento|calabac|berenjena|zanahoria|patata|boniato|calabaza|espinaca|br[oó]coli|coliflor|champi[ñn]|seta|pepino|puerro|apio|r[uú]cula|perejil|cilantro|albahaca|jengibre|fruta|verdura|ensalada/i, "fruta_verdura"],
  [/arroz|pasta|macarr|espagueti|fideo|lenteja|garbanzo|alubia|jud[ií]a|harina|az[uú]car|sal\b|aceite|vinagre|especia|piment[oó]n|comino|or[eé]gano|tomate frito|tomate triturado|at[uú]n|conserva|caldo|cereal|avena|galleta|chocolate|cacao|caf[eé]|\bt[eé](?=\s|$)|infusi|miel|mermelada|frutos secos|nueces|almendra|cacahuete|quinoa|cusc[uú]s|salsa|mayonesa|ketchup|mostaza|soja/i, "despensa"],
];

export function seccionDe(nombre: string): Seccion {
  for (const [patron, seccion] of PISTAS_SECCION) if (patron.test(nombre)) return seccion;
  return "otros";
}

/* ─── Nombres y cantidades ─────────────────────────────────── */

/**
 * Clave para comparar ingredientes: sin tildes, en minúscula y con
 * cada palabra recortada igual por los dos lados (sin la "s" y luego
 * sin la "e" finales). Así "tomates" y "tomate", o "limones" y
 * "limón", acaban en lo mismo. No es gramática: es para comparar.
 */
export function clave(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9ñ ]/g, " ")
    .split(/\s+/).filter(Boolean)
    .map((p) => {
      let r = p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p;
      if (r.length > 3 && r.endsWith("e")) r = r.slice(0, -1);
      return r;
    })
    .join(" ");
}

/** ¿Hablan del mismo producto? "Leche" vale para "leche entera". */
export function mismoProducto(a: string, b: string): boolean {
  const x = clave(a);
  const y = clave(b);
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

function numero(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

/** "600 g", "1,2 kg", "3 ud", "2 cda", "al gusto" */
export function textoCantidad(cantidad: number, unidad: Unidad): string {
  if (!cantidad) return "al gusto";
  if (unidad === "g") return cantidad >= 1000 ? `${numero(cantidad / 1000)} kg` : `${numero(cantidad)} g`;
  if (unidad === "ml") return cantidad >= 1000 ? `${numero(cantidad / 1000)} l` : `${numero(cantidad)} ml`;
  if (unidad === "pizca") return cantidad === 1 ? "1 pizca" : `${numero(cantidad)} pizcas`;
  return `${numero(cantidad)} ${unidad}`;
}

/** Los ingredientes de una receta para otro número de raciones. */
export function escalar(ingredientes: Ingrediente[], de: number, a: number): Ingrediente[] {
  const factor = de > 0 ? a / de : 1;
  return ingredientes.map((i) => ({ ...i, cantidad: i.cantidad * factor }));
}

/** Redondeo de tienda: hacia arriba, a cantidades que se pueden comprar. */
function redondearCompra(cantidad: number, unidad: Unidad): number {
  if (unidad === "ud") return Math.ceil(cantidad - 0.05);
  if (unidad === "g" || unidad === "ml") {
    const paso = cantidad > 100 ? 50 : 10;
    return Math.ceil(cantidad / paso) * paso;
  }
  return cantidad;
}

/** Lo que se da por hecho que hay en cualquier cocina. */
const SIEMPRE_HAY = /^(sal|agua|agua del grifo|hielo)$/;

export interface ProductoCompra {
  nombre: string;
  cantidad: string | null;
  seccion: Seccion;
  /** Las recetas que lo piden. */
  para: string[];
}

/**
 * La compra que sale del menú: suma los ingredientes de todas las
 * recetas del periodo (escalados a las raciones de cada hueco),
 * quita lo que ya hay en la nevera y lo redondea a cantidades de súper.
 */
export function calcularCompra(
  huecos: Hueco[],
  recetas: Receta[],
  nevera: ItemNevera[],
): { productos: ProductoCompra[]; yaTeneis: string[] } {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const suma = new Map<string, { nombre: string; unidad: Unidad; cantidad: number; seccion: Seccion; sinMedida: boolean; para: Set<string> }>();

  for (const h of huecos) {
    const r = h.receta_id ? porId.get(h.receta_id) : null;
    if (!r) continue;
    for (const ing of escalar(r.ingredientes, r.raciones, h.raciones)) {
      if (SIEMPRE_HAY.test(clave(ing.nombre))) continue;
      // Las cucharadas y pizcas no se compran: basta con que esté en la lista
      const sinMedida = !ing.cantidad || ing.unidad === "cda" || ing.unidad === "cdta" || ing.unidad === "pizca";
      const k = sinMedida ? `${clave(ing.nombre)}|-` : `${clave(ing.nombre)}|${ing.unidad}`;
      const previo = suma.get(k);
      if (previo) {
        previo.cantidad += sinMedida ? 0 : ing.cantidad;
        previo.para.add(r.nombre);
      } else {
        suma.set(k, {
          nombre: ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1),
          unidad: ing.unidad,
          cantidad: sinMedida ? 0 : ing.cantidad,
          seccion: ing.seccion,
          sinMedida,
          para: new Set([r.nombre]),
        });
      }
    }
  }

  const productos: ProductoCompra[] = [];
  const yaTeneis: string[] = [];
  for (const p of suma.values()) {
    if (nevera.some((n) => mismoProducto(n.nombre, p.nombre))) {
      yaTeneis.push(p.nombre);
      continue;
    }
    productos.push({
      nombre: p.nombre,
      cantidad: p.sinMedida ? null : textoCantidad(redondearCompra(p.cantidad, p.unidad), p.unidad),
      seccion: p.seccion,
      para: [...p.para],
    });
  }

  productos.sort((a, b) => SECCIONES[a.seccion].orden - SECCIONES[b.seccion].orden || a.nombre.localeCompare(b.nombre, "es"));
  return { productos, yaTeneis };
}

/* ─── Enlaces de inspiración ───────────────────────────────── */

export function buscarEnTikTok(nombre: string): string {
  return `https://www.tiktok.com/search?q=${encodeURIComponent(`${nombre} receta`)}`;
}

export function buscarEnPinterest(nombre: string): string {
  return `https://es.pinterest.com/search/pins/?q=${encodeURIComponent(`${nombre} receta`)}`;
}

export function buscarEnYouTube(nombre: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nombre} receta`)}`;
}

/* ─── Recetas ──────────────────────────────────────────────── */

function deBD(r: Receta): Receta {
  return {
    ...r,
    ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes : [],
    pasos: Array.isArray(r.pasos) ? r.pasos : [],
    etiquetas: r.etiquetas ?? [],
  };
}

export async function getRecetas(): Promise<Receta[]> {
  const { data } = await supabase
    .from("super_recetas").select("*")
    .order("created_at", { ascending: false }).limit(1000);
  return ((data ?? []) as Receta[]).map(deBD);
}

export async function crearReceta(r: RecetaNueva, quien: string): Promise<Receta | null> {
  const { data } = await supabase
    .from("super_recetas")
    .insert({ ...r, origen: r.origen ?? "ia", creada_por: quien })
    .select().single();
  return data ? deBD(data as Receta) : null;
}

export async function actualizarReceta(id: string, cambios: Partial<Receta>): Promise<boolean> {
  const { error } = await supabase
    .from("super_recetas")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function borrarReceta(id: string): Promise<boolean> {
  const { error } = await supabase.from("super_recetas").delete().eq("id", id);
  return !error;
}

/* ─── Menú ─────────────────────────────────────────────────── */

export async function getPlan(desde: string, hasta: string): Promise<Hueco[]> {
  const { data } = await supabase
    .from("super_plan").select("*")
    .gte("fecha", desde).lte("fecha", hasta)
    .order("fecha");
  return (data ?? []) as Hueco[];
}

export async function guardarHueco(
  fecha: string, momento: Momento,
  datos: { receta_id: string | null; texto: string | null; raciones?: number },
): Promise<boolean> {
  const { error } = await supabase
    .from("super_plan")
    .upsert(
      { fecha, momento, receta_id: datos.receta_id, texto: datos.texto?.trim() || null, raciones: datos.raciones ?? 2, hecho: false },
      { onConflict: "fecha,momento" },
    );
  return !error;
}

export async function vaciarHueco(fecha: string, momento: Momento): Promise<boolean> {
  const { error } = await supabase.from("super_plan").delete().eq("fecha", fecha).eq("momento", momento);
  return !error;
}

/** Marca un hueco como cocinado y suma una vez a su receta. */
export async function marcarHecho(h: Hueco, receta: Receta | null, hecho: boolean): Promise<boolean> {
  const { error } = await supabase.from("super_plan").update({ hecho }).eq("id", h.id);
  if (error) return false;
  if (receta && hecho) {
    await actualizarReceta(receta.id, {
      veces: receta.veces + 1,
      ultima_vez: !receta.ultima_vez || h.fecha > receta.ultima_vez ? h.fecha : receta.ultima_vez,
    });
  }
  return true;
}

/* ─── Lista de la compra ───────────────────────────────────── */

export async function getLista(): Promise<ItemLista[]> {
  const { data } = await supabase
    .from("super_lista").select("*")
    .order("created_at").limit(1000);
  return (data ?? []) as ItemLista[];
}

/**
 * Añade a la lista sin repetir lo que ya está pendiente.
 * Devuelve cuántos ha añadido de verdad.
 */
export async function anadirALista(
  productos: { nombre: string; cantidad: string | null; seccion?: Seccion }[],
  origen: ItemLista["origen"],
  quien: string,
  actuales: ItemLista[],
): Promise<number | null> {
  const pendientes = actuales.filter((i) => !i.comprado);
  const nuevos = productos
    .filter((p) => p.nombre.trim())
    .filter((p) => !pendientes.some((i) => mismoProducto(i.nombre, p.nombre)))
    .map((p) => ({
      nombre: p.nombre.trim(),
      cantidad: p.cantidad?.trim() || null,
      seccion: p.seccion ?? seccionDe(p.nombre),
      origen,
      anadido_por: quien,
    }));
  if (!nuevos.length) return 0;
  const { error } = await supabase.from("super_lista").insert(nuevos);
  return error ? null : nuevos.length;
}

export async function marcarComprado(id: string, comprado: boolean): Promise<boolean> {
  const { error } = await supabase.from("super_lista").update({ comprado }).eq("id", id);
  return !error;
}

export async function actualizarItem(id: string, cambios: Partial<Pick<ItemLista, "nombre" | "cantidad" | "seccion">>): Promise<boolean> {
  const { error } = await supabase.from("super_lista").update(cambios).eq("id", id);
  return !error;
}

export async function borrarDeLista(ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  const { error } = await supabase.from("super_lista").delete().in("id", ids);
  return !error;
}

/**
 * Compra hecha: lo marcado sale de la lista, pasa a la nevera (si
 * se quiere) y queda en el historial.
 */
export async function cerrarCompra(comprados: ItemLista[], aNevera: boolean): Promise<boolean> {
  if (aNevera) {
    const aGuardar = comprados
      .filter((i) => i.seccion !== "drogueria")
      .map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, seccion: i.seccion }));
    if (aGuardar.length) {
      const { error } = await supabase.from("super_nevera").insert(aGuardar);
      if (error) return false;
    }
  }
  const { error } = await supabase.from("super_compras").insert({
    productos: comprados.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, seccion: i.seccion })),
  });
  if (error) return false;
  return borrarDeLista(comprados.map((i) => i.id));
}

/* ─── Nevera ───────────────────────────────────────────────── */

export async function getNevera(): Promise<ItemNevera[]> {
  const { data } = await supabase
    .from("super_nevera").select("*")
    .order("created_at", { ascending: false }).limit(1000);
  return (data ?? []) as ItemNevera[];
}

export async function anadirANevera(
  productos: { nombre: string; cantidad?: string | null; caduca?: string | null }[],
): Promise<boolean> {
  const filas = productos
    .filter((p) => p.nombre.trim())
    .map((p) => ({ nombre: p.nombre.trim(), cantidad: p.cantidad?.trim() || null, caduca: p.caduca || null, seccion: seccionDe(p.nombre) }));
  if (!filas.length) return true;
  const { error } = await supabase.from("super_nevera").insert(filas);
  return !error;
}

export async function actualizarNevera(id: string, cambios: Partial<Pick<ItemNevera, "nombre" | "cantidad" | "caduca">>): Promise<boolean> {
  const { error } = await supabase.from("super_nevera").update(cambios).eq("id", id);
  return !error;
}

export async function sacarDeNevera(ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  const { error } = await supabase.from("super_nevera").delete().in("id", ids);
  return !error;
}

/* ─── Alergias ─────────────────────────────────────────────── */

/** Rut es alérgica a las nueces: se avisa siempre, venga de donde venga la receta. */
const NUECES = /\bnuez\b|\bnueces\b|frutos secos variados|mezcla de frutos secos/i;

export function avisoAlergia(r: Pick<Receta, "ingredientes" | "pasos" | "nombre">): string | null {
  const texto = [r.nombre, ...r.ingredientes.map((i) => i.nombre), ...r.pasos].join(" · ");
  return NUECES.test(texto) ? "Lleva nueces o frutos secos: Rut es alérgica" : null;
}

/* ─── Cocina ───────────────────────────────────────────────── */

export type Equipo = "fuegos" | "horno" | "airfryer" | "microondas" | "batidora" | "picadora";

export const EQUIPOS: Record<Equipo, { label: string; icon: string }> = {
  fuegos:     { label: "Fuegos",           icon: "🔥" },
  horno:      { label: "Horno",            icon: "♨️" },
  airfryer:   { label: "Freidora de aire", icon: "💨" },
  microondas: { label: "Microondas",       icon: "📡" },
  batidora:   { label: "Batidora",         icon: "🌀" },
  picadora:   { label: "Picadora",         icon: "🔪" },
};

export const EQUIPOS_INICIALES: Equipo[] = ["fuegos", "microondas", "batidora", "picadora"];

export async function getEquipos(): Promise<Equipo[]> {
  const { data } = await supabase.from("super_ajustes").select("valor").eq("clave", "equipos").maybeSingle();
  const valor = (data as { valor?: unknown } | null)?.valor;
  return Array.isArray(valor) ? (valor.filter((e) => typeof e === "string" && e in EQUIPOS) as Equipo[]) : EQUIPOS_INICIALES;
}

export async function guardarEquipos(equipos: Equipo[]): Promise<boolean> {
  const { error } = await supabase
    .from("super_ajustes")
    .upsert({ clave: "equipos", valor: equipos, updated_at: new Date().toISOString() }, { onConflict: "clave" });
  return !error;
}

/* ─── Lo que necesita cada uno ─────────────────────────────── */

export type Actividad = "sedentaria" | "ligera" | "moderada" | "alta";

export interface Perfil {
  persona: "alejandro" | "rut";
  sexo: "h" | "m";
  edad: number;
  altura_cm: number;
  peso_kg: number;
  actividad: Actividad;
}

export const ACTIVIDAD: Record<Actividad, { label: string; detalle: string; factor: number }> = {
  sedentaria: { label: "Poca",     detalle: "Trabajo sentado y casi sin deporte",     factor: 1.2 },
  ligera:     { label: "Algo",     detalle: "De pie o deporte 1–2 días por semana",   factor: 1.375 },
  moderada:   { label: "Bastante", detalle: "Deporte 3–5 días por semana",            factor: 1.55 },
  alta:       { label: "Mucha",    detalle: "Deporte casi a diario o trabajo físico", factor: 1.725 },
};

export interface Nutrientes {
  kcal: number;
  proteinas: number;
  hidratos: number;
  grasas: number;
  fibra: number;
}

/** Lo que va en comida y cena (el desayuno y lo de entre horas no se cuentan). */
export const PARTE_COMIDA_Y_CENA = 0.65;

/**
 * Lo que necesita al día para mantenerse comiendo sano: Mifflin-St Jeor
 * por la actividad, proteína a 1,4 g/kg, grasa al 30 % y el resto hidratos.
 */
export function necesidades(p: Perfil): Nutrientes {
  const basal = 10 * p.peso_kg + 6.25 * p.altura_cm - 5 * p.edad + (p.sexo === "h" ? 5 : -161);
  const kcal = Math.round((basal * ACTIVIDAD[p.actividad].factor) / 10) * 10;
  const proteinas = Math.round(1.4 * p.peso_kg);
  const grasas = Math.round((kcal * 0.3) / 9);
  const hidratos = Math.max(0, Math.round((kcal - proteinas * 4 - grasas * 9) / 4));
  return { kcal, proteinas, hidratos, grasas, fibra: p.sexo === "h" ? 30 : 25 };
}

export function parteComidaYCena(n: Nutrientes): Nutrientes {
  const f = PARTE_COMIDA_Y_CENA;
  return {
    kcal: Math.round(n.kcal * f), proteinas: Math.round(n.proteinas * f),
    hidratos: Math.round(n.hidratos * f), grasas: Math.round(n.grasas * f), fibra: Math.round(n.fibra * f),
  };
}

/** Lo que come una persona en esos huecos: una ración de cada plato. */
export function nutrientesDe(huecos: Hueco[], recetas: Receta[]): Nutrientes & { platos: number; sinDatos: number } {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const total = { kcal: 0, proteinas: 0, hidratos: 0, grasas: 0, fibra: 0, platos: 0, sinDatos: 0 };
  for (const h of huecos) {
    const r = h.receta_id ? porId.get(h.receta_id) : null;
    if (!r) continue;
    total.platos++;
    if (r.kcal_racion === null) { total.sinDatos++; continue; }
    total.kcal += r.kcal_racion ?? 0;
    total.proteinas += r.proteinas_racion ?? 0;
    total.hidratos += r.hidratos_racion ?? 0;
    total.grasas += r.grasas_racion ?? 0;
    total.fibra += r.fibra_racion ?? 0;
  }
  return total;
}

export async function getPerfiles(): Promise<Perfil[]> {
  const { data } = await supabase.from("super_perfiles").select("*");
  return ((data ?? []) as Perfil[]).map((p) => ({ ...p, peso_kg: Number(p.peso_kg) }));
}

export async function guardarPerfil(p: Perfil): Promise<boolean> {
  const { error } = await supabase
    .from("super_perfiles")
    .upsert({ ...p, updated_at: new Date().toISOString() }, { onConflict: "persona" });
  return !error;
}

/* ─── La IA de la cocina ───────────────────────────────────── */

/** Una sesión de batch cooking: qué preparar, en qué orden y cómo guardarlo. */
export interface SesionBatch {
  titular: string;
  duracion_min: number;
  pasos: { minuto: number; tarea: string; para: string }[];
  guardar: { plato: string; como: string; dias: number }[];
  consejo: string;
}

/** El resumen de cómo habéis comido una semana. */
export interface ResumenSemana {
  titular: string;
  bien: string[];
  mejorar: string[];
  consejo: string;
}

export type PeticionCocina =
  | { accion: "plan"; huecos: { fecha: string; momento: Momento }[]; deseo?: string }
  | { accion: "proponer"; huecos: { fecha: string; momento: Momento }[]; deseo?: string; evitar?: string[] }
  | { accion: "aplicar"; propuestas: Propuesta[] }
  | { accion: "foto"; foto_url: string; texto?: string }
  | { accion: "nevera"; deseo?: string }
  | { accion: "receta"; texto: string }
  | { accion: "importar"; texto: string }
  | { accion: "pasos"; receta_id: string }
  | { accion: "batch"; desde: string; hasta: string }
  | { accion: "resumen"; lunes: string };

export type RespuestaCocina =
  | { ok: true; recetas?: RecetaNueva[]; receta?: Receta; rellenados?: number; batch?: SesionBatch; resumen?: ResumenSemana; propuestas?: Propuesta[] }
  | { ok: false; error: string };

export async function pedirACocina(p: PeticionCocina, quien: string): Promise<RespuestaCocina> {
  try {
    const r = await fetch("/api/barcelona/cocina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, quien }),
    });
    let datos: RespuestaCocina;
    try {
      datos = (await r.json()) as RespuestaCocina;
    } catch {
      // Sin JSON: casi siempre es que el servidor ha cortado por tiempo
      return { ok: false, error: r.status === 504 ? "La IA ha tardado demasiado. Prueba otra vez." : "No ha salido bien. Prueba otra vez." };
    }
    if (!r.ok && datos.ok) return { ok: false, error: "No ha salido bien. Prueba otra vez." };
    return datos;
  } catch {
    return { ok: false, error: "Sin conexión. Prueba otra vez." };
  }
}
