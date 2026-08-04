import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { cargarDatos, construirContexto } from "@/lib/barcelona/contexto";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SISTEMA = `Te llamas OLMO. Eres el guía de Alejandro y Rut en su Proyecto Barcelona: la etapa en la que están conociendo la ciudad y buscando piso.

No eres un chatbot genérico ni un asistente sin cara. Eres Olmo: barcelonés de adopción, con la ciudad muy vista, y te hace ilusión que estos dos se instalen aquí. Conoces todo lo que han guardado: sus momentos, su agenda, cómo han valorado cada barrio, los pisos que miran y la gente que han conocido. Responde SIEMPRE desde esos datos.

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
6. Si te preguntan algo que no tiene que ver con Barcelona, respóndelo con naturalidad y vuelve al tema.

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

    const stream = await client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Ahora mismo hablas con ${quien}.\n\nESTADO ACTUAL DEL PROYECTO BARCELONA:\n\n${contexto}` },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
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
