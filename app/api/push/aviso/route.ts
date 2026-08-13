import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";

/* ============================================================
   «Mira lo que acabo de hacer».

   Cada vez que uno de los dos guarda algo —un momento, un
   gasto, una valoración— al otro le llega un aviso al móvil.

   La gracia no es enterarse: es que invite a contestar. Por
   eso los textos preguntan en vez de informar.
   ============================================================ */

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type Usuario = "alejandro" | "rut";

const NOMBRE: Record<Usuario, string> = { alejandro: "Alejandro", rut: "Rut" };

interface Aviso {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/**
 * Qué se le dice al otro según lo que haya pasado.
 * `que` es el nombre de la cosa; `extra` el detalle que venga bien.
 */
function componer(tipo: string, quien: string, que: string, extra: string, destino: Usuario): Aviso | null {
  const base = `/${destino}/barcelona`;

  switch (tipo) {
    case "momento":
      return {
        title: `${quien} ha guardado un momento 📸`,
        body: que ? `«${que}». ¿A que lo quieres ver?` : "¿A que lo quieres ver?",
        tag: "bcn-momento",
        url: `${base}/historia`,
      };

    case "plan":
      return {
        title: `${quien} ha apuntado un plan 🗓️`,
        body: que ? `${que}${extra ? ` · ${extra}` : ""}` : "Mira a ver qué te parece.",
        tag: "bcn-plan",
        url: `${base}/agenda`,
      };

    case "fotos":
      return {
        title: `${quien} ha subido fotos nuevas 🖼️`,
        body: que ? `De «${que}». Échales un ojo.` : "Échales un ojo.",
        tag: "bcn-fotos",
        url: `${base}/historia`,
      };

    case "valoracion_barrio":
      return {
        title: `${quien} ha valorado ${que} 🌆`,
        body: "¿Y a ti qué te pareció?",
        tag: "bcn-valora-barrio",
        url: `${base}/barrios`,
      };

    case "valoracion_piso":
      return {
        title: `${quien} ha valorado un piso 🏠`,
        body: que ? `«${que}». Falta lo que opines tú.` : "Falta lo que opines tú.",
        tag: "bcn-valora-piso",
        url: `${base}/vivienda`,
      };

    case "barrio":
      return {
        title: `${quien} quiere mirar ${que} 🗺️`,
        body: "Lo ha añadido a los sitios. Míralo y lo valoráis.",
        tag: "bcn-barrio",
        url: `${base}/barrios`,
      };

    case "gasto":
      return {
        title: `${quien} ha apuntado un gasto 🧾`,
        body: `${que}${extra ? ` · ${extra}` : ""}`,
        tag: "bcn-gasto",
        url: `${base}/gastos`,
      };

    case "aportacion":
      return {
        title: `${quien} ha metido dinero en el bote 💶`,
        body: extra ? `${extra}. Ya podéis tirar de ahí.` : "Ya podéis tirar de ahí.",
        tag: "bcn-bote",
        url: `${base}/gastos`,
      };

    case "contacto":
      return {
        title: `${quien} ha guardado un contacto 📇`,
        body: que ? `${que}. Por si te hace falta.` : "Por si te hace falta.",
        tag: "bcn-contacto",
        url: `${base}/contactos`,
      };

    case "piso":
      return {
        title: `${quien} ha guardado un piso 🏠`,
        body: `${que}${extra ? ` · ${extra}` : ""}. ¿Qué te parece?`,
        tag: "bcn-piso",
        url: `${base}/vivienda`,
      };

    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { de, tipo, que, extra } = (await req.json()) as {
      de: Usuario; tipo: string; que?: string; extra?: string;
    };

    if ((de !== "alejandro" && de !== "rut") || !tipo) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const para: Usuario = de === "alejandro" ? "rut" : "alejandro";
    const aviso = componer(tipo, NOMBRE[de], (que ?? "").trim(), (extra ?? "").trim(), para);
    if (!aviso) return NextResponse.json({ error: "Tipo desconocido" }, { status: 400 });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_name", para);

    if (!subs?.length) {
      return NextResponse.json({ enviados: 0, motivo: "el otro no tiene avisos activados" });
    }

    let enviados = 0;
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(aviso)
          );
          enviados++;
        } catch (e) {
          // 404 o 410: ese móvil ya no existe, se limpia
          const codigo = (e as { statusCode?: number }).statusCode;
          if (codigo === 404 || codigo === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      })
    );

    return NextResponse.json({ enviados });
  } catch (error) {
    console.error("Aviso al otro:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
