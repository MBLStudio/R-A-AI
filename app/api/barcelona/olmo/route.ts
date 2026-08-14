// ============================================================
// R&A · Barcelona — Lo que Olmo tiene que deciros hoy
//
// El chat espera a que le preguntéis. Esto es al revés: Olmo
// mira todo lo que tenéis guardado y decide él qué merece la
// pena contaros al abrir la app.
//
// Elige el qué, no rellena una plantilla. Por eso devuelve un
// JSON con hueco para una foto vuestra y para un empujón a la
// pantalla que toque: unos días saldrá un recuerdo, otros un
// barrio que nadie ha valorado, otros la cuenta del mes.
//
// Una al día y se guarda. Le pasamos también lo que dijo los
// días anteriores, que es lo único que impide que acabe
// repitiéndose.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { cargarDatos, construirContexto, diasDesde, type DatosEtapa } from "@/lib/barcelona/contexto";
import { rankear } from "@/lib/barcelona/compat";
import { urlEsVideo } from "@/lib/upload";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/**
 * A dónde puede mandaros: solo lo que está en el panel.
 * La vivienda se quitó de ahí, así que tampoco os manda allí.
 */
const SECCIONES = [
  "agenda", "historia", "barrios", "gastos", "mapa",
  "contactos", "nuestra-barcelona",
] as const;
type Seccion = (typeof SECCIONES)[number];

export interface TarjetaOlmo {
  texto: string;
  foto: { url: string; titulo: string; fecha: string } | null;
  accion: { seccion: Seccion; etiqueta: string } | null;
}

const SISTEMA = `Eres OLMO, el guía de Alejandro y Rut en su Proyecto Barcelona.

Esto no es una conversación: es la tarjeta que ven nada más abrir la app, antes de pedirte nada. Tú eliges qué contarles hoy.

QUÉ CONTAR
Mira todo lo que tienen guardado y quédate con UNA sola cosa, la que hoy tenga más valor. Algunas que suelen tenerlo:
- Un recuerdo que hace justo una semana, un mes o un año (si cuadra la fecha, díselo y enseña la foto).
- Un barrio que han pisado varias veces y ninguno de los dos ha valorado.
- Una diferencia real entre lo que opina cada uno, cuando dice algo interesante de ellos.
- Cómo va el dinero, si hay algo que llame la atención: el bote bajo, un mes disparado, uno que va muy por delante.
- La mudanza acercándose con cosas sin cerrar.
- Un hueco en la agenda que podrían aprovechar.

CÓMO ESCRIBIRLO
- Dos o tres frases. Nunca más. Se lee de un vistazo, de pie en el metro.
- Español de España, de tú, en plural. Cercano, con chispa, sin cursilería.
- Concreto SIEMPRE: nombres, cifras, fechas de las suyas. "Lleváis 421 € este mes" vale; "vais gastando bastante" no vale.
- Puedes acabar en pregunta o en empujón, pero no obligues: nada de "¡deberíais!".
- No los saludes ni digas su nombre. Entra directo.
- Texto llano: ni asteriscos, ni negritas, ni viñetas. Se pinta tal cual lo escribas.
- Nunca digas que eres una IA.

REGLAS DURAS
1. No inventes NADA. Solo lo que esté en el contexto.
2. Si no tienen casi nada guardado, dilo con naturalidad y propón algo pequeño por donde empezar.
3. No repitas lo que ya dijiste los días anteriores: te paso esos textos justo para eso. Busca otro ángulo.
4. Las cifras de dinero cópialas tal cual del contexto. No rehagas las cuentas.
5. Ni una palabra de pisos ni de la búsqueda de vivienda: eso lo tienen apartado. Aquí no toca.

EL JSON
- "texto": lo que les dices.
- "foto": el número de la lista, solo si de verdad viene a cuento enseñarla. Si no, null. No fuerces una foto para adornar. Si el número que eliges lleva [VÍDEO], habla de él como vídeo, no como foto.
- "seccion": a dónde llevarlos si tu mensaje pide ir a algún sitio. Si no, null.
- "etiqueta": el texto del botón, cortísimo y en imperativo ("Valorar Sants", "Ver los gastos"). null si no hay sección.`;

const ESQUEMA = {
  type: "object",
  properties: {
    texto: {
      type: "string",
      description: "Dos o tres frases, concretas y con datos suyos.",
    },
    foto: {
      anyOf: [{ type: "integer" }, { type: "null" }],
      description: "El número de una foto de la lista, o null.",
    },
    seccion: {
      anyOf: [{ type: "string", enum: [...SECCIONES] }, { type: "null" }],
      description: "A dónde llevarlos, o null.",
    },
    etiqueta: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "Texto del botón, cortísimo. null si no hay sección.",
    },
  },
  required: ["texto", "foto", "seccion", "etiqueta"],
  additionalProperties: false,
} as const;

/* ─── Las fotos que puede enseñar ──────────────────────────── */

interface FotoElegible {
  url: string;
  titulo: string;
  fecha: string;
  lugar: string | null;
  video: boolean;
}

/**
 * Numeradas, no por UUID: copiar un identificador largo es una
 * ocasión de equivocarse, y elegir un número no lo es.
 */
function fotosElegibles(d: DatosEtapa): FotoElegible[] {
  return d.momentos
    .filter((m) => m.estado === "vivido" && m.fotos.length > 0)
    .slice(0, 40)
    .map((m) => ({
      url: m.fotos[0],
      titulo: m.titulo,
      fecha: m.fecha,
      lugar: m.lugar ?? null,
      video: urlEsVideo(m.fotos[0]),
    }));
}

/* ─── Si la IA no está disponible ──────────────────────────── */
//
// Una tarjeta rota es peor que una tarjeta sosa. Esto no es
// listo, pero es verdad y sale siempre.

function tarjetaLocal(d: DatosEtapa): TarjetaOlmo {
  const valBarrios = d.valoraciones.filter((v) => v.entidad_tipo === "barrio");
  const sinValorar = d.barrios.filter((b) => !valBarrios.some((v) => v.entidad_id === b.id));
  const faltan = diasDesde(d.etapa.fecha_mudanza);

  if (sinValorar.length > 0) {
    const nombres = sinValorar.slice(0, 3).map((b) => b.nombre).join(", ");
    return {
      texto: `Tenéis ${sinValorar.length} barrios sin valorar todavía: ${nombres}${sinValorar.length > 3 ? "…" : ""}. Sin vuestra nota no salen en la comparativa.`,
      foto: null,
      accion: { seccion: "barrios", etiqueta: "Valorarlos" },
    };
  }

  if (faltan !== null && faltan < 0) {
    const mejor = rankear(d.barrios, valBarrios).find((r) => r.compat.porcentaje !== null);
    return {
      texto: `Quedan ${Math.abs(faltan)} días para la mudanza.${mejor ? ` De momento ${mejor.entidad.nombre} va ganando con un ${mejor.compat.porcentaje}%.` : ""}`,
      foto: null,
      accion: mejor ? { seccion: "barrios", etiqueta: "Ver los barrios" } : null,
    };
  }

  const vividos = d.momentos.filter((m) => m.estado === "vivido").length;
  return {
    texto: vividos > 0
      ? `Lleváis ${vividos} ${vividos === 1 ? "momento guardado" : "momentos guardados"} de esta etapa.`
      : "Todavía no habéis guardado nada. Empezad por un momento o valorando un barrio.",
    foto: null,
    accion: { seccion: "historia", etiqueta: "Ver la historia" },
  };
}

/* ─── Handler ──────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const { etapaId, force } = (await req.json()) as { etapaId: string; force?: boolean };
    if (!etapaId) {
      return NextResponse.json({ error: "Falta la etapa" }, { status: 400 });
    }

    const hoy = new Date().toISOString().slice(0, 10);

    // 1. ¿Ya se dijo algo hoy?
    if (!force) {
      const { data } = await supabase
        .from("bcn_ia")
        .select("contenido")
        .eq("etapa_id", etapaId)
        .eq("tipo", "olmo")
        .eq("clave", hoy)
        .maybeSingle();

      if (data?.contenido) {
        try {
          return NextResponse.json({ ...(JSON.parse(data.contenido) as TarjetaOlmo), cacheado: true });
        } catch {
          // Guardado de una versión anterior: se regenera y punto
        }
      }
    }

    const datos = await cargarDatos(etapaId);
    if (!datos) {
      return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ ...tarjetaLocal(datos), cacheado: false, sinIA: true });
    }

    // 2. Lo que dijo los días anteriores, para que busque otro ángulo
    const { data: anteriores } = await supabase
      .from("bcn_ia")
      .select("clave, contenido")
      .eq("etapa_id", etapaId)
      .eq("tipo", "olmo")
      .order("clave", { ascending: false })
      .limit(7);

    const dichos = (anteriores ?? [])
      .map((r) => {
        try {
          return `- ${r.clave}: "${(JSON.parse(r.contenido) as TarjetaOlmo).texto}"`;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .join("\n");

    // 3. Preparar lo que ve
    const fotos = fotosElegibles(datos);
    const listaFotos = fotos.length > 0
      ? fotos.map((f, i) => `${i + 1}. ${f.fecha} — ${f.titulo}${f.lugar ? ` (${f.lugar})` : ""}${f.video ? " [VÍDEO]" : ""}`).join("\n")
      : "(no tienen ninguna foto guardada todavía)";

    const contexto = construirContexto(datos, "completo", { pisos: true });

    const entrada =
      `ESTADO DEL PROYECTO BARCELONA:\n\n${contexto}\n\n` +
      `FOTOS QUE PUEDES ENSEÑAR (usa el número):\n${listaFotos}\n\n` +
      (dichos
        ? `LO QUE YA LES DIJISTE ESTOS DÍAS (no lo repitas):\n${dichos}`
        : "Es la primera vez que les dices algo aquí.");

    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: ESQUEMA },
      },
      system: SISTEMA,
      messages: [{ role: "user", content: entrada }],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ ...tarjetaLocal(datos), cacheado: false, sinIA: true });
    }

    const crudo = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let salida: { texto?: string; foto?: number | null; seccion?: string | null; etiqueta?: string | null };
    try {
      salida = JSON.parse(crudo);
    } catch {
      return NextResponse.json({ ...tarjetaLocal(datos), cacheado: false, sinIA: true });
    }

    if (!salida.texto?.trim()) {
      return NextResponse.json({ ...tarjetaLocal(datos), cacheado: false, sinIA: true });
    }

    // 4. Resolver lo que eligió, sin fiarnos del número
    const i = typeof salida.foto === "number" ? salida.foto - 1 : -1;
    const elegida = i >= 0 && i < fotos.length ? fotos[i] : null;

    const seccion = SECCIONES.includes(salida.seccion as Seccion) ? (salida.seccion as Seccion) : null;

    const tarjeta: TarjetaOlmo = {
      texto: salida.texto.trim(),
      foto: elegida ? { url: elegida.url, titulo: elegida.titulo, fecha: elegida.fecha } : null,
      accion: seccion
        ? { seccion, etiqueta: salida.etiqueta?.trim() || "Ver" }
        : null,
    };

    // 5. Guardar la de hoy
    await supabase.from("bcn_ia").upsert(
      {
        etapa_id: etapaId,
        tipo: "olmo",
        clave: hoy,
        contenido: JSON.stringify(tarjeta),
        created_at: new Date().toISOString(),
      },
      { onConflict: "etapa_id,tipo,clave" }
    );

    return NextResponse.json({ ...tarjeta, cacheado: false });
  } catch (error) {
    console.error("Olmo error:", error);
    return NextResponse.json({ error: "Error generando la tarjeta" }, { status: 500 });
  }
}
