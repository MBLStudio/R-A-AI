import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const MESSAGES = {
  beso: (from: string) => ({
    title: `${from === "alejandro" ? "Alejandro" : "Rut"} te manda un beso 💋`,
    body: "Va por adelantado. El de verdad, esta noche 💗",
    tag: "carino-beso",
  }),
  abrazo: (from: string) => ({
    title: `${from === "alejandro" ? "Alejandro" : "Rut"} te manda un abrazo 🤗`,
    body: "Guárdalo hasta que te lo dé en persona 🥹💗",
    tag: "carino-abrazo",
  }),
};

export async function POST(req: NextRequest) {
  try {
    const { fromUser, tipo } = await req.json() as { fromUser: string; tipo: "beso" | "abrazo" };

    if (!fromUser || !tipo || !MESSAGES[tipo]) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const toUser = fromUser === "alejandro" ? "rut" : "alejandro";

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_name", toUser);

    if (!subs?.length) {
      return NextResponse.json({ sent: 0, reason: "no subscriptions for recipient" });
    }

    const { title, body, tag } = MESSAGES[tipo](fromUser);
    const payload = JSON.stringify({ title, body, tag, url: `/${toUser}` });

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

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent, tipo, toUser });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
