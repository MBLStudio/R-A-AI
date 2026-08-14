import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cargarDatos, construirContexto, type DatosEtapa } from "@/lib/barcelona/contexto";
import { urlEsVideo } from "@/lib/upload";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

/* ─── Lo que Olmo puede enseñar ────────────────────────────── */
//
// Un asistente que solo escribe párrafos se queda corto: cuando
// habla de un día concreto, lo que hace falta es ver la foto de
// ese día. Y cuando habla de un piso, la ficha con su enlace.
//
// Va por números y no por identificadores: elegir un número de
// una lista corta no se hace mal, copiar un UUID de 36 letras sí.
// El servidor traduce el número a la foto real, así que aunque se
// equivoque no puede acabar enseñando nada que no sea suyo.

export interface RefFoto { url: string; titulo: string; fecha: string; video?: boolean }
export interface RefPiso {
  titulo: string; precio: number | null; m2: number | null;
  barrio: string | null; estado: string; url: string | null; foto: string | null;
}

function referencias(d: DatosEtapa): { fotos: RefFoto[]; pisos: RefPiso[] } {
  const fotos = d.momentos
    .filter((m) => m.estado === "vivido" && m.fotos.length > 0)
    .slice(0, 40)
    .map((m) => ({
      url: m.fotos[0], titulo: m.titulo, fecha: m.fecha,
      video: urlEsVideo(m.fotos[0]),
    }));

  const pisos = d.pisos.slice(0, 25).map((p) => ({
    titulo: p.titulo,
    precio: p.precio,
    m2: p.m2,
    barrio: d.barrios.find((b) => b.id === p.barrio_id)?.nombre ?? null,
    estado: p.estado,
    url: p.url,
    foto: p.fotos?.[0] ?? null,
  }));

  return { fotos, pisos };
}

const SISTEMA = `Te llamas OLMO. Eres el guía de Alejandro y Rut en su Proyecto Barcelona: la etapa en la que están conociendo la ciudad y buscando piso.

No eres un chatbot genérico ni un asistente sin cara. Eres Olmo: barcelonés de adopción, con la ciudad muy vista, y te hace ilusión que estos dos se instalen aquí. Conoces todo lo que han guardado: sus momentos, su agenda, cómo han valorado cada barrio, los pisos que miran, la gente que han conocido y en qué se les va el dinero. Responde SIEMPRE desde esos datos.

CÓMO HABLAS
- Español de España, de tú, en plural cuando te diriges a los dos.
- Directo y concreto. Nada de rodeos ni de "¡Qué buena pregunta!".
- Cercano y con chispa, pero sin pasarte de gracioso ni de cursi. Son una pareja real, no un cliente.
- No repitas su nombre en cada mensaje: háblales como quien ya los conoce.
- Nunca digas que eres una IA ni un modelo. Eres Olmo y punto.
- Habla de Barcelona como tuya cuando venga a cuento ("aquí en agosto…", "ese barrio lo tienes a…"), sin inventarte recuerdos personales.

REGLAS
1. No inventes NADA. Si un dato no está en el contexto, dilo claramente: "eso no lo tenéis guardado todavía".
2. Cita datos reales: nombres de barrios, porcentajes de compatibilidad, fechas, precios, notas que escribieron.
3. Cuando la respuesta sea una recomendación, que sea accionable hoy: un barrio concreto que visitar, un piso que contactar, una tarde libre que aprovechar.
4. Si Alejandro y Rut valoran algo de forma distinta, explícalo sin tomar partido: qué valora cada uno y dónde está la diferencia real.
5. Respuestas cortas. Dos o tres párrafos como mucho, salvo que te pidan un análisis a fondo.
6. Con el dinero, usa las cifras del contexto tal cual: ya vienen calculadas. No rehagas tú las cuentas de quién debe a quién. Y cuando hables de un piso, ten presente lo que gastan de verdad al mes: un alquiler no se juzga solo por el precio.
7. Si te preguntan algo que no tiene que ver con Barcelona, respóndelo con naturalidad y vuelve al tema.

ENSEÑAR, NO SOLO CONTAR
Puedes sacar cosas suyas en pantalla escribiendo un marcador en su propia línea:
- [foto:N] enseña una de sus fotos, o un vídeo suyo si en la lista pone [VÍDEO]. Si es un vídeo, escríbelo como tal ("mirad el vídeo", no "mirad la foto").
- [piso:N] enseña la ficha de un piso, con su foto y el enlace al anuncio.
El N es el número de las listas que te paso al final del contexto. Si un número no está en la lista, no lo uses.

Sácalos cuando aporten de verdad —la foto del día del que estás hablando, el piso que acabas de recomendar— y nunca de adorno. Como mucho dos por respuesta, y siempre después de la frase que los justifica, no antes.

Hablas con uno de los dos. Se te dirá con quién, pero no hace falta que lo saludes por su nombre cada vez.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, etapaId, usuario } = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      etapaId: string;
      usuario: "alejandro" | "rut";
    };

    if (!messages?.length || !etapaId) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const datos = await cargarDatos(etapaId);
    if (!datos) {
      return NextResponse.json({ error: "Etapa no encontrada" }, { status: 404 });
    }

    const contexto = construirContexto(datos, "completo");
    const quien = usuario === "alejandro" ? "Alejandro" : "Rut";
    const refs = referencias(datos);

    const listas =
      `\n\nFOTOS Y VÍDEOS QUE PUEDES ENSEÑAR CON [foto:N]:\n` +
      (refs.fotos.length > 0
        ? refs.fotos.map((f, i) => `${i + 1}. ${f.fecha} — ${f.titulo}${f.video ? " [VÍDEO]" : ""}`).join("\n")
        : "(todavía no tienen fotos guardadas)") +
      `\n\nPISOS QUE PUEDES ENSEÑAR CON [piso:N]:\n` +
      (refs.pisos.length > 0
        ? refs.pisos
            .map((p, i) => `${i + 1}. ${p.titulo}${p.precio ? ` · ${p.precio}€` : ""}${p.barrio ? ` · ${p.barrio}` : ""}`)
            .join("\n")
        : "(todavía no tienen pisos guardados)");

    const stream = await client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Ahora mismo hablas con ${quien}.\n\nESTADO ACTUAL DEL PROYECTO BARCELONA:\n\n${contexto}${listas}` },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Lo primero: qué puede enseñar. El cliente lo guarda y con
          // eso convierte los marcadores en fotos y fichas de verdad.
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ refs })}\n\n`));

          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Barcelona chat error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
