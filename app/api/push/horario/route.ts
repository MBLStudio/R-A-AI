import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";
import {
  PERSONAS, hoyMadrid, sumarDias, getTurnos, textoTramos, minutosTurno, textoHoras,
} from "@/lib/barcelona/trabajo";

/* ============================================================
   «Mañana trabajas de 10:00 a 18:00».

   Cada noche a las 23:00 (hora de Madrid) le llega a cada uno
   su horario del día siguiente. Solo si hay algo apuntado.

   Vercel programa los crons en UTC y España cambia de hora:
   a las 23:00 de Madrid son las 21:00 UTC en verano y las
   22:00 UTC en invierno. Por eso el cron salta a las dos horas
   y aquí solo se envía en la que de verdad son las 23 en Madrid.
   ============================================================ */

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function horaEnMadrid(): number {
  return Number(new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23",
  }).format(new Date()));
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?probar=1 se salta la comprobación de la hora, para probarlo a mano
  const probar = req.nextUrl.searchParams.get("probar") === "1";
  if (!probar && horaEnMadrid() !== 23) {
    return NextResponse.json({ sent: 0, motivo: "no son las 23 en Madrid" });
  }

  const hoy = hoyMadrid();
  const manana = sumarDias(hoy, 1);
  let sent = 0;

  for (const p of PERSONAS) {
    const dias = await getTurnos(p.id, hoy, manana);
    const turnoHoy = dias.find((t) => t.fecha === hoy);
    const turno = dias.find((t) => t.fecha === manana);
    // Sin apuntar o de vacaciones: no hace falta avisar cada noche
    if (!turno || turno.tipo === "vacaciones") continue;
    // Un día sin trabajo solo se anuncia al salir de uno de trabajo:
    // así no llega "mañana libre" el sábado por la noche, ni dos veces seguidas
    if (turno.tipo !== "trabajo" && turnoHoy?.tipo !== "trabajo") continue;

    const aviso =
      turno.tipo === "libre" ? { title: "Mañana libre ☕", body: "Nada de despertador. Que lo disfrutes." } :
      turno.tipo === "festivo" ? { title: "Mañana es festivo 🎉", body: "Día para los dos. ¿Plan?" } :
      {
        title: "Tu horario de mañana 💼",
        body: `${textoTramos(turno.tramos)} · ${textoHoras(minutosTurno(turno))}${turno.nota ? ` · ${turno.nota}` : ""}`,
      };

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_name", p.id);

    const envios = (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...aviso, url: `/${p.id}/barcelona/trabajo`, tag: "horario-manana" })
        );
      } catch (err) {
        const codigo = (err as { statusCode?: number })?.statusCode;
        // Suscripción caducada: fuera, como en el resto de avisos
        if (codigo === 410 || codigo === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        throw err;
      }
    });

    const resultados = await Promise.allSettled(envios);
    sent += resultados.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ sent, manana });
}
