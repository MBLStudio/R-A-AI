import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";
import { getDailyMessage } from "@/lib/daily-content";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function sendToSub(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: object
) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_name");

  if (error || !subs?.length) return NextResponse.json({ sent: 0 });

  const message = getDailyMessage();

  const sends = subs.map((sub) => {
    const nombre = sub.user_name === "rut" ? "Rut" : "Alejandro";

    return sendToSub(sub, {
      title: `💗 Buenos días, ${nombre}`,
      body: message,
      url: `/${sub.user_name}`,
      tag: "daily-message",
    });
  });

  const results = await Promise.allSettled(sends);
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, message: message.slice(0, 60) });
}
