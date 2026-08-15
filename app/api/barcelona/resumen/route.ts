import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { rankear } from "@/lib/barcelona/compat";
import { cargarDatos, construirContexto, diasDesde, type DatosEtapa } from "@/lib/barcelona/contexto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type TipoResumen = "hub" | "semanal" | "narrativa";

// ─── Prompts ─────────────────────────────────────────────────

const VOZ = `Escribes para Alejandro y Rut, una pareja que pasa una temporada en Barcelona conociendo la ciudad.
Les hablas de tú, en plural, en español de España, con cercanía y sin cursilería impostada.
No inventes NADA: si un dato no está en el contexto, no lo menciones. No uses emojis salvo que se te pida.
No empieces con "Aquí tienes" ni con ningún preámbulo: entra directo.
La búsqueda de piso la llevan por otro lado: no la menciones ni preguntes por ella.`;

function promptHub(): string {
  return `${VOZ}

Escribe el resumen que ven al abrir su Proyecto Barcelona. Máximo 5 frases cortas, cada una en su línea, sin viñetas ni guiones.

Estructura:
1. Dónde están en el viaje (días, o cuánto falta para llegar).
2. Uno o dos hechos concretos de lo que llevan hecho.
3. El barrio que va ganando, si hay datos para decirlo.
4. Lo próximo que tienen en la agenda, si hay algo.
5. Una recomendación concreta y accionable, empezando por "Recomendación:".

Si apenas hay datos, dilo con naturalidad y sugiere por dónde empezar. No rellenes con frases vacías.`;
}

function promptSemanal(): string {
  return `${VOZ}

Escribe el resumen de la última semana. Máximo 6 frases.

Cubre: qué han hecho estos días, qué han descubierto y cómo evoluciona la compatibilidad de los barrios.
Termina con una línea que empiece por "Próximo objetivo:" proponiendo algo concreto para la semana que viene.
Si la semana ha estado vacía, dilo sin dramatizar y propón algo sencillo.`;
}

function promptNarrativa(): string {
  return `${VOZ}

Escribe "Nuestra Barcelona": la historia de esta etapa contada como un relato breve, no como un informe.

Entre 4 y 6 párrafos cortos. En pasado, salvo el final si la etapa sigue abierta.
Recorre los momentos que marcaron el viaje, cómo fueron cambiando de opinión sobre los barrios, los lugares que les gustaron y la gente que se cruzó por el camino.
Usa los detalles reales del contexto: fechas, nombres de barrios, notas que escribieron. Son lo que hace que el texto sea suyo y no de cualquiera.
Nada de listas ni titulares. Es un texto para releer dentro de unos años.`;
}

const CONFIG: Record<TipoResumen, { prompt: () => string; maxTokens: number; effort: "low" | "medium" }> = {
  hub:       { prompt: promptHub,       maxTokens: 2048, effort: "low" },
  semanal:   { prompt: promptSemanal,   maxTokens: 3072, effort: "medium" },
  narrativa: { prompt: promptNarrativa, maxTokens: 6144, effort: "medium" },
};

// ─── Fallback sin IA ─────────────────────────────────────────
// Si la API falla o no hay clave, el hub sigue funcionando.

function resumenLocal(d: DatosEtapa): string {
  const dias = diasDesde(d.etapa.fecha_llegada);
  const vividos = d.momentos.filter((m) => m.estado === "vivido").length;
  const hoy = new Date().toISOString().slice(0, 10);
  const proximo = d.momentos
    .filter((m) => m.estado === "previsto" && m.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const valBarrios = d.valoraciones.filter((v) => v.entidad_tipo === "barrio");
  const mejor = rankear(d.barrios, valBarrios).find((r) => r.compat.porcentaje !== null);

  const l: string[] = [];
  if (dias === null) l.push(`${d.etapa.nombre}.`);
  else if (dias < 0) l.push(`Faltan ${Math.abs(dias)} días para llegar a ${d.etapa.ciudad}.`);
  else if (dias === 0) l.push(`Hoy es el día. Bienvenidos a ${d.etapa.ciudad}.`);
  else l.push(`Lleváis ${dias} ${dias === 1 ? "día" : "días"} en ${d.etapa.ciudad}.`);

  if (vividos > 0) l.push(`Habéis guardado ${vividos} ${vividos === 1 ? "momento" : "momentos"}.`);
  if (mejor) l.push(`${mejor.entidad.nombre} es ahora mismo vuestro barrio más compatible (${mejor.compat.porcentaje}%).`);
  if (proximo) l.push(`Lo próximo: ${proximo.titulo}, el ${proximo.fecha}.`);
  if (l.length === 1) l.push("Aún no hay nada guardado. Empezad añadiendo un momento o valorando un barrio.");

  return l.join("\n");
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { etapaId, tipo = "hub", clave, force } = (await req.json()) as {
      etapaId: string;
      tipo?: TipoResumen;
      clave?: string;
      force?: boolean;
    };

    if (!etapaId || !CONFIG[tipo as TipoResumen]) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const claveCache = clave ?? tipo;

    // 1. Cargar el estado de la etapa
    const datos = await cargarDatos(etapaId);
    if (!datos) {
      return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
    }

    // 2. ¿Han cambiado los datos desde la última generación?
    // Sin pisos: la vivienda está fuera del panel y fuera de lo que se
    // escribe. Al entrar en el hash, además, esto invalida lo generado
    // antes y se rehace solo la primera vez.
    const contexto = construirContexto(datos, "resumen", { pisos: true });
    const hash = createHash("sha1").update(tipo + "|" + contexto).digest("hex");

    if (!force) {
      const { data: cache } = await supabase
        .from("bcn_ia")
        .select("contenido, datos_hash, created_at")
        .eq("etapa_id", etapaId)
        .eq("tipo", tipo)
        .eq("clave", claveCache)
        .maybeSingle();

      // La narrativa y el resumen semanal se conservan aunque cambien los datos:
      // son piezas escritas, no un indicador en vivo.
      const permanente = tipo === "narrativa" || tipo === "semanal";
      if (cache && (permanente || cache.datos_hash === hash)) {
        return NextResponse.json({ contenido: cache.contenido, cacheado: true });
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ contenido: resumenLocal(datos), cacheado: false, sinIA: true });
    }

    // 3. Generar
    const cfg = CONFIG[tipo as TipoResumen];
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: cfg.maxTokens,
      output_config: { effort: cfg.effort },
      system: cfg.prompt(),
      messages: [{ role: "user", content: `Este es el estado actual:\n\n${contexto}` }],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ contenido: resumenLocal(datos), cacheado: false, sinIA: true });
    }

    const contenido = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!contenido) {
      return NextResponse.json({ contenido: resumenLocal(datos), cacheado: false, sinIA: true });
    }

    // 4. Cachear
    await supabase.from("bcn_ia").upsert(
      {
        etapa_id: etapaId,
        tipo,
        clave: claveCache,
        contenido,
        datos_hash: hash,
        created_at: new Date().toISOString(),
      },
      { onConflict: "etapa_id,tipo,clave" }
    );

    return NextResponse.json({ contenido, cacheado: false });
  } catch (error) {
    console.error("Barcelona resumen error:", error);
    return NextResponse.json({ error: "Error generando el resumen" }, { status: 500 });
  }
}
