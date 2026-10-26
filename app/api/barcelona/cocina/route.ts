import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { getTurnos, sumarDias, fechaCorta, textoTramos, type Turno } from "@/lib/barcelona/trabajo";
import {
  SECCIONES, EQUIPOS, EQUIPOS_INICIALES, avisoAlergia,
  type Receta, type RecetaNueva, type ItemNevera, type Momento, type Hueco, type Equipo,
  type PeticionCocina, type RespuestaCocina, type Seccion, type Unidad,
  type SesionBatch, type ResumenSemana,
} from "@/lib/barcelona/super";

/* ============================================================
   La IA de la cocina.

   Una sola puerta con siete cosas que sabe hacer:
     · plan      → rellena huecos del menú (y los guarda)
     · nevera    → tres recetas con lo que hay en casa
     · receta    → una receta a partir de una idea suelta
     · importar  → una receta a partir de un enlace o un texto
                   (TikTok, Pinterest, un blog…)
     · pasos     → la elaboración de una receta que aún no la tiene
     · batch     → cómo cocinar de una sentada lo de varios días
     · resumen   → cómo habéis comido una semana, sin sermones

   Siempre responde en JSON con un esquema fijo (structured
   outputs), así la pantalla nunca recibe algo que no sabe leer.

   Va con la cookie de sesión (proxy.ts no la exime): descarga
   páginas de internet y no puede quedar abierta.
   ============================================================ */

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODELO = "claude-opus-5-5";

/* ─── Esquemas ─────────────────────────────────────────────── */

const SECCIONES_ENUM = Object.keys(SECCIONES) as Seccion[];
const UNIDADES: Unidad[] = ["g", "ml", "ud", "cda", "cdta", "pizca"];

const INGREDIENTE = {
  type: "object",
  additionalProperties: false,
  required: ["nombre", "cantidad", "unidad", "seccion"],
  properties: {
    nombre: { type: "string", description: "Nombre genérico de súper español, sin marca. Ej: 'Garbanzos cocidos', 'Cebolla'." },
    cantidad: { type: "number", description: "Cantidad para las raciones de la receta. 0 si es al gusto." },
    unidad: { type: "string", enum: UNIDADES },
    seccion: { type: "string", enum: SECCIONES_ENUM },
  },
};

function esquemaReceta(conPasos: boolean) {
  const propiedades: Record<string, unknown> = {
    nombre: { type: "string" },
    descripcion: { type: "string", description: "Una o dos frases que den ganas de hacerla." },
    raciones: { type: "integer" },
    tiempo_min: { type: "integer", description: "Minutos de principio a fin." },
    dificultad: { type: "string", enum: ["facil", "media", "elaborada"] },
    kcal_racion: { type: "integer", description: "Kcal por ración, estimadas con los ingredientes." },
    proteinas_racion: { type: "integer", description: "Gramos de proteína por ración." },
    hidratos_racion: { type: "integer", description: "Gramos de hidratos de carbono por ración." },
    grasas_racion: { type: "integer", description: "Gramos de grasa por ración." },
    fibra_racion: { type: "integer", description: "Gramos de fibra por ración." },
    etiquetas: { type: "array", items: { type: "string" }, description: "2 a 4 etiquetas cortas en minúscula: 'rápida', 'tupper', 'alta en proteína', 'vegetariana', 'para dos'…" },
    ingredientes: { type: "array", items: INGREDIENTE },
  };
  if (conPasos) {
    propiedades.pasos = { type: "array", items: { type: "string" }, description: "Pasos claros y concretos, uno por elemento, con tiempos y fuegos." };
  }
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(propiedades),
    properties: propiedades,
  };
}

const RECETA_COMPLETA = esquemaReceta(true);
const RECETA_SIN_PASOS = esquemaReceta(false);

/* ─── Contexto común ───────────────────────────────────────── */

function hoyEnMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function temporada(fecha: string): string {
  const mes = Number(fecha.slice(5, 7));
  if (mes >= 3 && mes <= 5) return "primavera (alcachofas, espárragos, guisantes, habas, fresas)";
  if (mes >= 6 && mes <= 8) return "verano (tomate, pimiento, calabacín, berenjena, gazpacho y salmorejo)";
  if (mes >= 9 && mes <= 11) return "otoño (setas, calabaza, puerro, coliflor y los primeros guisos de cuchara)";
  return "invierno (legumbres de cuchara, cocidos, coliflor, puerro, cardo, cítricos)";
}

async function equipos(): Promise<Equipo[]> {
  const { data } = await supabase.from("super_ajustes").select("valor").eq("clave", "equipos").maybeSingle();
  const valor = (data as { valor?: unknown } | null)?.valor;
  return Array.isArray(valor) ? (valor.filter((e) => typeof e === "string" && e in EQUIPOS) as Equipo[]) : EQUIPOS_INICIALES;
}

/** Quiénes son, cómo cocinan y lo que no se negocia. Igual para todas las acciones. */
async function voz(fecha: string): Promise<string> {
  const hay = await equipos();
  const tienen = hay.map((e) => EQUIPOS[e].label.toLowerCase()).join(", ");
  const faltan = (Object.keys(EQUIPOS) as Equipo[]).filter((e) => !hay.includes(e)).map((e) => EQUIPOS[e].label.toLowerCase());

  return `Eres la cocinera de confianza de Alejandro y Rut, una pareja joven que vive en Barcelona y se va a vivir junta. Quieren comer sano y rico, sin dietas estrictas ni contar cada gramo.

Cómo viven:
- Los dos trabajan por la mañana o a la hora de comer. Por eso, normalmente por la noche cocinan la cena y, a la vez, la comida del día siguiente, que se llevan en tupper.
- Compran en súper de barrio (Mercadona, Bonpreu, Lidl) y en mercado. Presupuesto ajustado: buena relación calidad-precio.

Su cocina: ${tienen}.${faltan.length ? ` NO tienen ${faltan.join(", ")}: ninguna receta puede necesitarlo.` : ""}

Lo que buscan: COCINA ESPAÑOLA DE TODA LA VIDA, la de casa. Sencilla pero no básica: platos reconocibles, con sabor y bien hechos, como los haría una madre o una abuela. Se vale algún toque que los haga especiales, pero sin convertirlos en otra cosa.
Su estilo, por ejemplo: alubias con chorizo, lentejas estofadas, garbanzos con espinacas, patatas a la riojana, pollo al ajillo, pollo en pepitoria, albóndigas en salsa, carne guisada con patatas, macarrones con chorizo, arroz con pollo, pisto con huevo, tortilla de patatas, filetes empanados, judías verdes con patatas, sopa castellana, revuelto de setas, lomo en salsa, ensaladilla.

Lo que no se negocia:
- Rut es ALÉRGICA A LAS NUECES. Nunca uses nueces ni mezclas de frutos secos, ni como topping ni en salsas.
- NO les gusta y no se propone, ni como ingrediente principal: boniato, verduras raras (kale, pak choi, edamame, tofu, tempeh, quinoa, cuscús…), bowls, platos asiáticos o de fusión (teriyaki, curry, ramen, poke, wok con soja dulce, sriracha…) y en general las recetas "de influencer".
- Comen poco pescado: como mucho una vez por semana, y a la española y sencillo (merluza en salsa verde, bacalao con tomate, atún con tomate…).

Es ${temporada(fecha)}: tira de producto de temporada y de mercado.
Platos equilibrados: proteína, verdura y un hidrato, como se ha comido siempre en casa. Alejandro hace deporte: en los platos principales, unos 25-35 g de proteína por ración cuando encaje.

Formato: nombres de platos cortos y con gancho, en español de España. Ingredientes con nombres genéricos de súper, sin marcas. Cantidades realistas en estas unidades: g, ml, ud (unidades), cda (cucharada), cdta (cucharadita), pizca. Cantidad 0 = al gusto. Valores nutricionales por ración, estimados con criterio a partir de los ingredientes.`;
}

async function gustos(): Promise<{ texto: string; recetas: Receta[] }> {
  const { data } = await supabase
    .from("super_recetas")
    .select("id, nombre, valoracion, etiquetas, ultima_vez, veces")
    .limit(500);
  const recetas = (data ?? []) as Receta[];
  const nombres = (v: string) => recetas.filter((r) => r.valoracion === v).map((r) => r.nombre);
  const encanta = nombres("encanta");
  const bien = nombres("bien");
  const nunca = nombres("nunca");
  const texto = [
    encanta.length ? `Les ENCANTA: ${encanta.join("; ")}.` : "",
    bien.length ? `Les gusta: ${bien.join("; ")}.` : "",
    nunca.length ? `NO quieren volver a comer (ni nada muy parecido): ${nunca.join("; ")}.` : "",
  ].filter(Boolean).join("\n");
  return { texto: texto || "Todavía no han valorado ningún plato.", recetas };
}

async function textoNevera(): Promise<{ texto: string; items: ItemNevera[] }> {
  const { data } = await supabase.from("super_nevera").select("*").limit(300);
  const items = (data ?? []) as ItemNevera[];
  if (!items.length) return { texto: "La nevera está vacía o sin apuntar.", items };
  const lineas = [...items]
    .sort((a, b) => (a.caduca ?? "9999").localeCompare(b.caduca ?? "9999"))
    .map((i) => `- ${i.nombre}${i.cantidad ? ` (${i.cantidad})` : ""}${i.caduca ? ` · caduca ${fechaCorta(i.caduca)}` : ""}`);
  return { texto: lineas.join("\n"), items };
}

/* ─── Llamada a Claude ─────────────────────────────────────── */

async function pedir<T>(opciones: {
  system: string;
  usuario: string;
  esquema: Record<string, unknown>;
  effort: "low" | "medium";
  maxTokens: number;
}): Promise<T | null> {
  try {
    const mensaje = await client.messages.create({
      model: MODELO,
      max_tokens: opciones.maxTokens,
      system: opciones.system,
      output_config: {
        effort: opciones.effort,
        format: { type: "json_schema", schema: opciones.esquema },
      },
      messages: [{ role: "user", content: opciones.usuario }],
    });
    // Rechazo o respuesta cortada: mejor no devolver nada que devolver medio JSON
    if (mensaje.stop_reason === "refusal" || mensaje.stop_reason === "max_tokens") return null;
    const bloque = mensaje.content.find((b) => b.type === "text");
    if (!bloque || bloque.type !== "text") return null;
    return JSON.parse(bloque.text) as T;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.error("cocina: límite de la API");
    else if (err instanceof Anthropic.APIError) console.error(`cocina: API ${err.status}`, err.message);
    else console.error("cocina:", err);
    return null;
  }
}

/** La IA a veces se pasa o se queda corta: se deja todo dentro de lo razonable. */
function sanear(r: RecetaNueva, conPasos: boolean): RecetaNueva {
  const entero = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
  return {
    nombre: String(r.nombre ?? "").trim().slice(0, 120) || "Receta sin nombre",
    descripcion: String(r.descripcion ?? "").trim().slice(0, 400) || null,
    raciones: entero(r.raciones, 1, 20) ?? 2,
    tiempo_min: entero(r.tiempo_min, 1, 600),
    dificultad: r.dificultad && ["facil", "media", "elaborada"].includes(r.dificultad) ? r.dificultad : null,
    kcal_racion: entero(r.kcal_racion, 0, 3000),
    proteinas_racion: entero(r.proteinas_racion, 0, 300),
    hidratos_racion: entero(r.hidratos_racion, 0, 500),
    grasas_racion: entero(r.grasas_racion, 0, 300),
    fibra_racion: entero(r.fibra_racion, 0, 100),
    etiquetas: (Array.isArray(r.etiquetas) ? r.etiquetas : []).map((e) => String(e).toLowerCase().trim()).filter(Boolean).slice(0, 5),
    ingredientes: (Array.isArray(r.ingredientes) ? r.ingredientes : [])
      .filter((i) => i && String(i.nombre ?? "").trim())
      .map((i) => ({
        nombre: String(i.nombre).trim().slice(0, 80),
        cantidad: typeof i.cantidad === "number" && i.cantidad > 0 ? Math.round(i.cantidad * 10) / 10 : 0,
        unidad: UNIDADES.includes(i.unidad) ? i.unidad : "ud",
        seccion: SECCIONES_ENUM.includes(i.seccion) ? i.seccion : "otros",
      })),
    pasos: conPasos ? (Array.isArray(r.pasos) ? r.pasos : []).map((p) => String(p).trim()).filter(Boolean) : [],
  };
}

/** Segunda comprobación de la alergia, por si la IA se despista: queda avisado en la nota. */
function conAviso(r: RecetaNueva): RecetaNueva {
  const aviso = avisoAlergia(r);
  if (!aviso) return r;
  return { ...r, nota: [`⚠️ ${aviso}`, r.nota].filter(Boolean).join("\n") };
}

/* ─── plan ─────────────────────────────────────────────────── */

const MAX_HUECOS = 14; // una semana por petición: así cabe en el tiempo de Vercel

function lineaTurno(nombre: string, t: Turno | undefined): string {
  if (!t) return `${nombre}: sin horario apuntado`;
  if (t.tipo !== "trabajo") return `${nombre}: ${t.tipo}`;
  return `${nombre}: trabaja ${textoTramos(t.tramos)}`;
}

async function plan(huecos: { fecha: string; momento: Momento }[], deseo: string, quien: string): Promise<RespuestaCocina> {
  const validos = huecos
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.fecha) && (h.momento === "comida" || h.momento === "cena"))
    .slice(0, MAX_HUECOS);
  if (!validos.length) return { ok: false, error: "No hay huecos que rellenar." };

  const fechas = [...new Set(validos.map((h) => h.fecha))].sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];

  const [g, turnosRut, turnosAle, cercano, sistemaBase] = await Promise.all([
    gustos(),
    getTurnos("rut", desde, hasta),
    getTurnos("alejandro", desde, hasta),
    // Lo que ya está en el menú alrededor, para no repetir
    supabase.from("super_plan").select("fecha, momento, receta_id, texto")
      .gte("fecha", sumarDias(desde, -7)).lte("fecha", sumarDias(hasta, 7)),
    voz(desde),
  ]);

  const nombrePorId = new Map(g.recetas.map((r) => [r.id, r.nombre]));
  const yaEnMenu = ((cercano.data ?? []) as Hueco[])
    .map((h) => `${h.fecha} ${h.momento}: ${h.receta_id ? nombrePorId.get(h.receta_id) ?? "receta" : h.texto ?? ""}`)
    .join("\n");

  const reutilizables = g.recetas
    .filter((r) => r.valoracion === "encanta" || r.valoracion === "bien")
    .map((r) => `- ${r.id} · ${r.nombre}${r.valoracion === "encanta" ? " ❤️" : ""}${r.ultima_vez ? ` (última vez ${r.ultima_vez})` : ""}`)
    .join("\n");

  const dias = fechas.map((f) => {
    const momentos = validos.filter((h) => h.fecha === f).map((h) => h.momento).join(" y ");
    return `${f} (${fechaCorta(f)}) → hay que poner: ${momentos}\n   ${lineaTurno("Rut", turnosRut.find((t) => t.fecha === f))} · ${lineaTurno("Alejandro", turnosAle.find((t) => t.fecha === f))}`;
  }).join("\n");

  const system = `${sistemaBase}

Ahora organizas su MENÚ de comidas y cenas. Reglas:
- Rellena exactamente los huecos que se piden, ni uno más.
- Toda comida tiene que poder hacerse la noche antes y llevarse en tupper (comerse templada o recalentada en microondas). Etiqueta "tupper".
- Piensa la cena de un día y la comida del día siguiente como UNA sesión de cocina por la noche: entre las dos, una hora como mucho, y mejor si comparten algún ingrediente o elaboración.
- Mira los horarios de cada día: si Rut sale a las 20:30 o más tarde, esa noche todo rápido (cena de 20 minutos como mucho: un revuelto, una tortilla, un plancha con ensalada…). Los días que libran los dos, algo con más fundamento para cocinar juntos: un buen guiso, un arroz… ("para dos").
- Variedad: no repitas la proteína principal dos veces seguidas. A la semana, legumbre 2 o 3 veces, como mucho un pescado y verdura todos los días.
- Puedes repetir platos que les encantan o les gustan (lista de abajo, con su id) más o menos en uno de cada cuatro huecos, sin repetir ninguno que hayan comido en los últimos 10 días.
- Nunca propongas nada de lo que NO quieren.
- Las recetas nuevas, para 2 raciones y SIN pasos (los pasos se piden aparte cuando los quieran ver).

Sus gustos:
${g.texto}`;

  const usuario = `Huecos a rellenar y horarios de cada día:
${dias}

Platos que ya tienen en el menú cerca de estas fechas (no los repitas):
${yaEnMenu || "Ninguno."}

Platos suyos que puedes repetir (usa el id exacto en "reutilizar"):
${reutilizables || "Ninguno todavía."}
${deseo ? `\nLo que les apetece esta vez: ${deseo}` : ""}`;

  type Salida = {
    reutilizar: { fecha: string; momento: Momento; receta_id: string }[];
    nuevas: { fecha: string; momento: Momento; receta: RecetaNueva }[];
  };

  const salida = await pedir<Salida>({
    system,
    usuario,
    effort: "low",
    maxTokens: 16000,
    esquema: {
      type: "object",
      additionalProperties: false,
      required: ["reutilizar", "nuevas"],
      properties: {
        reutilizar: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["fecha", "momento", "receta_id"],
            properties: {
              fecha: { type: "string", description: "AAAA-MM-DD" },
              momento: { type: "string", enum: ["comida", "cena"] },
              receta_id: { type: "string" },
            },
          },
        },
        nuevas: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["fecha", "momento", "receta"],
            properties: {
              fecha: { type: "string", description: "AAAA-MM-DD" },
              momento: { type: "string", enum: ["comida", "cena"] },
              receta: RECETA_SIN_PASOS,
            },
          },
        },
      },
    },
  });

  if (!salida) return { ok: false, error: "La IA no ha podido preparar el menú. Prueba otra vez." };

  // Solo vale lo que se ha pedido, y cada hueco una vez
  const pedido = new Set(validos.map((h) => `${h.fecha}|${h.momento}`));
  const hecho = new Set<string>();
  const filas: { fecha: string; momento: Momento; receta_id: string; raciones: number; hecho: boolean; texto: null }[] = [];

  for (const r of salida.reutilizar ?? []) {
    const k = `${r.fecha}|${r.momento}`;
    if (!pedido.has(k) || hecho.has(k) || !nombrePorId.has(r.receta_id)) continue;
    hecho.add(k);
    filas.push({ fecha: r.fecha, momento: r.momento, receta_id: r.receta_id, raciones: 2, hecho: false, texto: null });
  }

  const nuevas = (salida.nuevas ?? [])
    .map((n) => ({ ...n, receta: n.receta ? sanear(n.receta, false) : null }))
    .filter((n): n is { fecha: string; momento: Momento; receta: RecetaNueva } => {
      const k = `${n.fecha}|${n.momento}`;
      // Una receta con nueces no entra en el menú, aunque la IA la proponga
      if (!pedido.has(k) || hecho.has(k) || !n.receta || avisoAlergia(n.receta)) return false;
      hecho.add(k);
      return true;
    });

  if (nuevas.length) {
    const { data, error } = await supabase
      .from("super_recetas")
      .insert(nuevas.map((n) => ({ ...n.receta, origen: "ia", creada_por: quien })))
      .select("id");
    if (error || !data) return { ok: false, error: "No se han podido guardar las recetas nuevas." };
    // Supabase devuelve las filas en el orden en que se insertaron
    nuevas.forEach((n, i) => {
      const id = (data[i] as { id: string } | undefined)?.id;
      if (id) filas.push({ fecha: n.fecha, momento: n.momento, receta_id: id, raciones: 2, hecho: false, texto: null });
    });
  }

  // Lo que había en esos huecos antes de cambiarlo (cuando se rehace la semana)
  const antes = ((cercano.data ?? []) as Hueco[])
    .filter((h) => h.receta_id && hecho.has(`${h.fecha}|${h.momento}`))
    .map((h) => h.receta_id as string);

  if (filas.length) {
    const { error } = await supabase.from("super_plan").upsert(filas, { onConflict: "fecha,momento" });
    if (error) return { ok: false, error: "No se ha podido guardar el menú." };
  }

  // Las recetas sustituidas que puso la IA y nadie llegó a cocinar ni valorar, fuera:
  // así el recetario no se llena de platos que no quisisteis
  const viejas = [...new Set(antes)].filter((id) => !filas.some((f) => f.receta_id === id));
  if (viejas.length) {
    const { data: siguen } = await supabase.from("super_plan").select("receta_id").in("receta_id", viejas);
    const usadas = new Set(((siguen ?? []) as { receta_id: string }[]).map((x) => x.receta_id));
    const sobran = viejas.filter((id) => !usadas.has(id));
    if (sobran.length) {
      await supabase.from("super_recetas").delete()
        .in("id", sobran).eq("origen", "ia").eq("veces", 0).is("valoracion", null);
    }
  }

  return { ok: true, rellenados: filas.length };
}

/* ─── nevera ───────────────────────────────────────────────── */

async function desdeNevera(deseo: string): Promise<RespuestaCocina> {
  const [g, n, sistemaBase] = await Promise.all([gustos(), textoNevera(), voz(hoyEnMadrid())]);
  if (!n.items.length && !deseo) {
    return { ok: false, error: "Apunta antes lo que tenéis en la nevera, o escribe qué os apetece." };
  }

  const salida = await pedir<{ recetas: RecetaNueva[] }>({
    system: `${sistemaBase}

Ahora te enseñan lo que tienen en la nevera y la despensa. Propón TRES recetas originales y distintas entre sí:
- Aprovecha sobre todo lo que tienen, empezando por lo que caduca antes.
- Puedes suponer básicos de despensa (aceite, sal, especias, ajo, harina, arroz o pasta). Como mucho, 2 o 3 cosas más que haya que comprar.
- Una muy rápida (15 minutos), una con calma y un clásico de casa de los de toda la vida.
- 2 raciones cada una, con pasos.
- Nada de lo que NO quieren.

Sus gustos:
${g.texto}`,
    usuario: `En casa hay:\n${n.texto}${deseo ? `\n\nLo que les apetece: ${deseo}` : ""}`,
    effort: "low",
    maxTokens: 12000,
    esquema: {
      type: "object", additionalProperties: false, required: ["recetas"],
      properties: { recetas: { type: "array", items: RECETA_COMPLETA } },
    },
  });

  if (!salida?.recetas?.length) return { ok: false, error: "La IA no ha podido proponer nada. Prueba otra vez." };
  return { ok: true, recetas: salida.recetas.slice(0, 3).map((r) => conAviso(sanear(r, true))) };
}

/* ─── receta a partir de una idea ──────────────────────────── */

async function desdeIdea(texto: string): Promise<RespuestaCocina> {
  const idea = texto.trim().slice(0, 1500);
  if (!idea) return { ok: false, error: "Escribe qué receta queréis." };
  const [g, sistemaBase] = await Promise.all([gustos(), voz(hoyEnMadrid())]);

  const salida = await pedir<RecetaNueva>({
    system: `${sistemaBase}

Te piden UNA receta. Si la idea es vaga ("algo con pollo", "una cena ligera"), elige un plato español de toda la vida que encaje. Si es un plato concreto, haz la mejor versión casera de ese plato. 2 raciones salvo que digan otra cosa, con pasos.

Sus gustos:
${g.texto}`,
    usuario: idea,
    effort: "low",
    maxTokens: 6000,
    esquema: RECETA_COMPLETA,
  });

  if (!salida) return { ok: false, error: "La IA no ha podido escribir la receta. Prueba otra vez." };
  return { ok: true, recetas: [conAviso({ ...sanear(salida, true), origen: "ia" })] };
}

/* ─── importar desde un enlace ─────────────────────────────── */

const HOSTS_PROHIBIDOS = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|::|.*\.local$|.*\.internal$)/i;

function urlSegura(texto: string): URL | null {
  try {
    const u = new URL(texto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (HOSTS_PROHIBIDOS.test(u.hostname)) return null;
    // Sin IPs a pelo: una receta siempre vive en un dominio
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

/** Descarga con redirecciones a mano, comprobando cada salto. */
async function descargar(url: URL, aceptar = "text/html,application/json"): Promise<string | null> {
  let actual = url;
  for (let salto = 0; salto < 4; salto++) {
    let r: Response;
    try {
      r = await fetch(actual, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
          "Accept": aceptar,
          "Accept-Language": "es-ES,es;q=0.9",
        },
      });
    } catch {
      return null;
    }
    if (r.status >= 300 && r.status < 400) {
      const destino = r.headers.get("location");
      const siguiente = destino ? urlSegura(new URL(destino, actual).toString()) : null;
      if (!siguiente) return null;
      actual = siguiente;
      continue;
    }
    if (!r.ok) return null;
    const cuerpo = await r.text();
    return cuerpo.slice(0, 1_500_000);
  }
  return null;
}

function meta(html: string, nombre: string): string | null {
  const patron = new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]*content=["']([^"']*)["']`, "i");
  const inverso = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${nombre}["']`, "i");
  return html.match(patron)?.[1] ?? html.match(inverso)?.[1] ?? null;
}

function desentidad(t: string): string {
  return t
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** Si la página trae su receta en datos estructurados (schema.org), se usa tal cual. */
function recetaEstructurada(html: string): string | null {
  const bloques = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const esReceta = (o: unknown): o is Record<string, unknown> => {
    if (!o || typeof o !== "object") return false;
    const tipo = (o as Record<string, unknown>)["@type"];
    return tipo === "Recipe" || (Array.isArray(tipo) && tipo.includes("Recipe"));
  };
  for (const b of bloques) {
    try {
      const datos: unknown = JSON.parse(b[1].trim());
      const grafo = (datos && typeof datos === "object" && !Array.isArray(datos))
        ? ((datos as Record<string, unknown>)["@graph"] as unknown[] | undefined) ?? []
        : [];
      const candidatos: unknown[] = Array.isArray(datos) ? datos : [datos, ...grafo];
      const receta = candidatos.find(esReceta);
      if (receta) return JSON.stringify(receta).slice(0, 20_000);
    } catch { /* bloque roto: al siguiente */ }
  }
  return null;
}

function soloTexto(html: string): string {
  return desentidad(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim().slice(0, 15_000);
}

/** Lo que se puede leer de un enlace. TikTok, por su vista previa oficial (oEmbed). */
async function leerEnlace(url: URL): Promise<string | null> {
  const host = url.hostname.replace(/^www\./, "");

  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const oembed = await descargar(new URL(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`), "application/json");
    if (oembed) {
      try {
        const d = JSON.parse(oembed) as { title?: string; author_name?: string };
        if (d.title) return `Vídeo de TikTok de @${d.author_name ?? "alguien"}. Descripción del vídeo:\n${d.title}`;
      } catch { /* sigue con la página */ }
    }
  }

  const html = await descargar(url);
  if (!html) return null;

  const estructurada = recetaEstructurada(html);
  if (estructurada) return `Receta publicada en ${host} (datos estructurados):\n${estructurada}`;

  const titulo = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  const descripcion = meta(html, "og:description") ?? meta(html, "description") ?? "";
  return `Página de ${host}.\nTítulo: ${desentidad(titulo)}\nDescripción: ${desentidad(descripcion)}\nTexto:\n${soloTexto(html)}`;
}

async function importar(texto: string): Promise<RespuestaCocina> {
  const entrada = texto.trim().slice(0, 8000);
  if (!entrada) return { ok: false, error: "Pega un enlace o el texto de la receta." };

  // Del texto compartido nos quedamos con el enlace, si lo hay
  const suelto = entrada.match(/https?:\/\/[^\s"'<>]+/)?.[0] ?? null;
  let contenido = entrada;
  let enlace: string | null = null;

  if (suelto) {
    const url = urlSegura(suelto);
    if (!url) return { ok: false, error: "Ese enlace no se puede abrir." };
    enlace = url.toString();
    const leido = await leerEnlace(url);
    if (!leido) return { ok: false, error: "No he podido leer ese enlace. Prueba a pegar el texto de la receta." };
    const resto = entrada.replace(suelto, "").trim();
    contenido = resto ? `${leido}\n\nLo que escribieron al compartirlo: ${resto}` : leido;
  }

  const sistemaBase = await voz(hoyEnMadrid());
  const salida = await pedir<{ encontrada: boolean; receta: RecetaNueva; supuesto: string }>({
    system: `${sistemaBase}

Te pasan una receta vista en internet (TikTok, Pinterest, un blog…) o escrita a mano. Conviértela en una ficha clara para su recetario, en español:
- Respeta el plato original. No lo cambies por otro, aunque lleve algo que no encaje con su cocina o sus normas: eso se avisa aparte.
- Si faltan cantidades o pasos (pasa mucho en TikTok), complétalos con criterio de cocinera, para 2 raciones, y explica en "supuesto" qué has tenido que imaginar. Si no has supuesto nada, deja "supuesto" vacío.
- Si necesita algo que no tienen en la cocina, dilo en "supuesto" y, si se puede, explica cómo adaptarlo.
- Si en el contenido no hay ninguna receta reconocible, pon "encontrada" a false y rellena lo demás con lo mínimo.`,
    usuario: contenido,
    effort: "low",
    maxTokens: 8000,
    esquema: {
      type: "object", additionalProperties: false,
      required: ["encontrada", "receta", "supuesto"],
      properties: {
        encontrada: { type: "boolean" },
        receta: RECETA_COMPLETA,
        supuesto: { type: "string" },
      },
    },
  });

  if (!salida) return { ok: false, error: "La IA no ha podido leer la receta. Prueba otra vez." };
  if (!salida.encontrada) return { ok: false, error: "Ahí no he encontrado ninguna receta. Prueba a pegar el texto." };

  return {
    ok: true,
    recetas: [conAviso({
      ...sanear(salida.receta, true),
      origen: enlace ? "enlace" : "nuestra",
      enlace,
      nota: salida.supuesto?.trim() ? `Completado por la IA: ${salida.supuesto.trim()}` : null,
    })],
  };
}

/* ─── pasos de una receta guardada ─────────────────────────── */

async function pasos(recetaId: string): Promise<RespuestaCocina> {
  const { data } = await supabase.from("super_recetas").select("*").eq("id", recetaId).maybeSingle();
  const receta = data as Receta | null;
  if (!receta) return { ok: false, error: "Esa receta ya no existe." };

  const ingredientes = (receta.ingredientes ?? [])
    .map((i) => `- ${i.nombre}: ${i.cantidad ? `${i.cantidad} ${i.unidad}` : "al gusto"}`)
    .join("\n");

  const sistemaBase = await voz(hoyEnMadrid());
  const salida = await pedir<{ pasos: string[] }>({
    system: `${sistemaBase}

Escribe la elaboración de una receta que ya tienen: pasos claros, en orden, uno por elemento, con fuegos, tiempos y el punto exacto que hay que buscar. Usa sus ingredientes y cantidades; no añadas otros salvo básicos de despensa. Entre 4 y 10 pasos. Si es para tupper, termina con cómo guardarla y recalentarla. Un último consejo para que quede de 10.`,
    usuario: `Receta: ${receta.nombre}${receta.descripcion ? `\n${receta.descripcion}` : ""}\nRaciones: ${receta.raciones}\nIngredientes:\n${ingredientes || "(sin apuntar: elige tú los de la versión clásica)"}`,
    effort: "low",
    maxTokens: 4000,
    esquema: {
      type: "object", additionalProperties: false, required: ["pasos"],
      properties: { pasos: { type: "array", items: { type: "string" } } },
    },
  });

  const lista = (salida?.pasos ?? []).map((p) => String(p).trim()).filter(Boolean);
  if (!lista.length) return { ok: false, error: "La IA no ha podido escribir los pasos. Prueba otra vez." };

  const { data: actualizada, error } = await supabase
    .from("super_recetas")
    .update({ pasos: lista, updated_at: new Date().toISOString() })
    .eq("id", recetaId).select().single();
  if (error || !actualizada) return { ok: false, error: "No se han podido guardar los pasos." };
  return { ok: true, receta: actualizada as Receta };
}

/* ─── lo del menú de unas fechas, con sus recetas ──────────── */

async function menuConRecetas(desde: string, hasta: string): Promise<{ huecos: Hueco[]; recetas: Map<string, Receta> }> {
  const { data } = await supabase.from("super_plan").select("*").gte("fecha", desde).lte("fecha", hasta).order("fecha");
  const huecos = (data ?? []) as Hueco[];
  const ids = [...new Set(huecos.map((h) => h.receta_id).filter((x): x is string => !!x))];
  const recetas = new Map<string, Receta>();
  if (ids.length) {
    const { data: rs } = await supabase.from("super_recetas").select("*").in("id", ids);
    for (const r of (rs ?? []) as Receta[]) recetas.set(r.id, r);
  }
  return { huecos, recetas };
}

/* ─── batch cooking ────────────────────────────────────────── */

async function batch(desde: string, hasta: string): Promise<RespuestaCocina> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde) {
    return { ok: false, error: "Fechas incorrectas." };
  }
  const { huecos, recetas } = await menuConRecetas(desde, hasta);
  const conReceta = huecos.filter((h) => h.receta_id && recetas.has(h.receta_id));
  if (!conReceta.length) return { ok: false, error: "No hay platos en el menú para esos días. Planificad antes la semana." };

  const lineas = conReceta.map((h) => {
    const r = recetas.get(h.receta_id!)!;
    const ings = (r.ingredientes ?? []).map((i) => `${i.nombre}${i.cantidad ? ` ${i.cantidad} ${i.unidad}` : ""}`).join(", ");
    return `- ${h.fecha} ${h.momento}: ${r.nombre} (${r.tiempo_min ?? "?"} min). Ingredientes: ${ings}`;
  }).join("\n");

  const sistemaBase = await voz(desde);
  const salida = await pedir<SesionBatch>({
    system: `${sistemaBase}

Ahora organizas una sesión de BATCH COOKING: cocinar de una sentada lo que se pueda adelantar de los platos de esos días.
- Un plan cronológico realista con lo que tienen en su cocina: qué empezar primero, qué se hace en paralelo mientras algo cuece, cuándo ir montando tuppers. "minuto" es cuándo empieza cada tarea desde el inicio.
- Adelanta solo lo que aguanta bien (bases, legumbres, cereales, salsas, proteínas cocinadas, verdura asada o cortada). Lo que hay que hacer al momento, dilo.
- Para cada plato, cómo guardarlo y cuántos días aguanta en nevera; si conviene congelar, dilo.
- Tono cercano, sin tecnicismos. "titular" es una frase corta y animada; "consejo", un truco práctico.`,
    usuario: `Platos del menú entre ${fechaCorta(desde)} y ${fechaCorta(hasta)}:\n${lineas}`,
    effort: "medium",
    maxTokens: 8000,
    esquema: {
      type: "object", additionalProperties: false,
      required: ["titular", "duracion_min", "pasos", "guardar", "consejo"],
      properties: {
        titular: { type: "string" },
        duracion_min: { type: "integer" },
        pasos: {
          type: "array",
          items: {
            type: "object", additionalProperties: false, required: ["minuto", "tarea", "para"],
            properties: {
              minuto: { type: "integer" },
              tarea: { type: "string" },
              para: { type: "string", description: "Para qué plato o platos es." },
            },
          },
        },
        guardar: {
          type: "array",
          items: {
            type: "object", additionalProperties: false, required: ["plato", "como", "dias"],
            properties: {
              plato: { type: "string" },
              como: { type: "string" },
              dias: { type: "integer" },
            },
          },
        },
        consejo: { type: "string" },
      },
    },
  });

  if (!salida?.pasos?.length) return { ok: false, error: "La IA no ha podido organizar la sesión. Prueba otra vez." };
  return { ok: true, batch: salida };
}

/* ─── resumen de la semana ─────────────────────────────────── */

async function resumen(lunes: string): Promise<RespuestaCocina> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lunes)) return { ok: false, error: "Fecha incorrecta." };
  const domingo = sumarDias(lunes, 6);
  const { huecos, recetas } = await menuConRecetas(lunes, domingo);
  if (!huecos.length) return { ok: false, error: "Esa semana no hay nada en el menú." };

  const lineas = huecos.map((h) => {
    const r = h.receta_id ? recetas.get(h.receta_id) : null;
    if (!r) return `- ${h.fecha} ${h.momento}: ${h.texto ?? "sin apuntar"}`;
    const n = r.kcal_racion !== null
      ? ` · ${r.kcal_racion} kcal, ${r.proteinas_racion ?? "?"} g prot, ${r.hidratos_racion ?? "?"} g hidratos, ${r.grasas_racion ?? "?"} g grasa, ${r.fibra_racion ?? "?"} g fibra`
      : "";
    const ings = (r.ingredientes ?? []).slice(0, 10).map((i) => i.nombre).join(", ");
    return `- ${h.fecha} ${h.momento}${h.hecho ? " (cocinado)" : ""}: ${r.nombre}${n}. Lleva: ${ings}`;
  }).join("\n");

  const sistemaBase = await voz(lunes);
  const salida = await pedir<ResumenSemana>({
    system: `${sistemaBase}

Ahora haces el RESUMEN de cómo han comido una semana (comidas y cenas; el desayuno no se cuenta). Como una amiga que sabe de nutrición, nada de sermones ni tono de dietista:
- "titular": una frase corta y con chispa sobre la semana.
- "bien": 2 o 3 cosas concretas que han hecho bien (variedad, legumbre, verdura, proteína, cocinar en casa…).
- "mejorar": 1 o 2 cosas concretas y fáciles, sin culpas. Si todo está bien, una idea para la semana que viene.
- "consejo": una idea práctica para la próxima semana (un plato de casa que les vendría bien, un truco…).
Básate solo en el menú que te pasan.`,
    usuario: `Menú de la semana del ${fechaCorta(lunes)} al ${fechaCorta(domingo)}:\n${lineas}`,
    effort: "low",
    maxTokens: 3000,
    esquema: {
      type: "object", additionalProperties: false,
      required: ["titular", "bien", "mejorar", "consejo"],
      properties: {
        titular: { type: "string" },
        bien: { type: "array", items: { type: "string" } },
        mejorar: { type: "array", items: { type: "string" } },
        consejo: { type: "string" },
      },
    },
  });

  if (!salida) return { ok: false, error: "La IA no ha podido hacer el resumen. Prueba otra vez." };
  return { ok: true, resumen: salida };
}

/* ─── Entrada ──────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "Falta la clave de la IA." }, { status: 503 });
  }

  let p: PeticionCocina & { quien?: string };
  try {
    p = (await req.json()) as PeticionCocina & { quien?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Petición incorrecta." }, { status: 400 });
  }

  const quien = p.quien === "rut" || p.quien === "alejandro" ? p.quien : "ia";
  let respuesta: RespuestaCocina;

  switch (p.accion) {
    case "plan":
      respuesta = await plan(Array.isArray(p.huecos) ? p.huecos : [], String(p.deseo ?? "").slice(0, 500), quien);
      break;
    case "nevera":
      respuesta = await desdeNevera(String(p.deseo ?? "").slice(0, 500));
      break;
    case "receta":
      respuesta = await desdeIdea(String(p.texto ?? ""));
      break;
    case "importar":
      respuesta = await importar(String(p.texto ?? ""));
      break;
    case "pasos":
      respuesta = await pasos(String(p.receta_id ?? ""));
      break;
    case "batch":
      respuesta = await batch(String(p.desde ?? ""), String(p.hasta ?? ""));
      break;
    case "resumen":
      respuesta = await resumen(String(p.lunes ?? ""));
      break;
    default:
      return NextResponse.json({ ok: false, error: "No sé hacer eso." }, { status: 400 });
  }

  return NextResponse.json(respuesta, { status: respuesta.ok ? 200 : 422 });
}
