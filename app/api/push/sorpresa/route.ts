import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const EVENTS: Record<string, { to: string; title: string; body: string; url: string }> = {
  // Alejandro revela la sorpresa → avisar a Rut
  revelada: {
    to: "rut",
    title: "Alejandro tiene una sorpresa para ti 🎁",
    body: "Ha preparado algo especial. Toca para abrirlo…",
    url: "/rut/sorpresa",
  },
  // Rut abre la sorpresa → avisar a Alejandro
  abierta: {
    to: "alejandro",
    title: "Rut abrió tu sorpresa 💗",
    body: "Acaba de leer tu carta.",
    url: "/alejandro/sorpresa",
  },
};

export async function POST(req: NextRequest) {
  try {
    const { event } = (await req.json()) as { event?: string };
    const cfg = EVENTS[event ?? "revelada"];
    if (!cfg) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_name", cfg.to);

    if (error || !subs?.length) return NextResponse.json({ sent: 0 });

    const payload = JSON.stringify({
      title: cfg.title,
      body: cfg.body,
      url: cfg.url,
      tag: "sorpresa",
    });

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          throw err;
        }
      })
    );

    return NextResponse.json({ sent: results.filter((r) => r.status === "fulfilled").length });
  } catch (err) {
    console.error("sorpresa push error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
