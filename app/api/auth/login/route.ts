import { NextRequest, NextResponse } from "next/server";
import { crearToken, contrasenaCorrecta, opcionesCookie } from "@/lib/auth";

/** Pequeño freno a la fuerza bruta: por IP, en memoria. */
const intentos = new Map<string, { n: number; hasta: number }>();
const MAX = 8;
const CASTIGO = 10 * 60_000;

export async function POST(req: NextRequest) {
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json(
      { error: "Falta APP_PASSWORD en el servidor." },
      { status: 503 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ahora = Date.now();
  const registro = intentos.get(ip);

  if (registro && registro.n >= MAX && ahora < registro.hasta) {
    const minutos = Math.ceil((registro.hasta - ahora) / 60_000);
    return NextResponse.json(
      { error: `Demasiados intentos. Prueba en ${minutos} min.` },
      { status: 429 }
    );
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };

  if (!password || !contrasenaCorrecta(password)) {
    const n = (registro && ahora < registro.hasta ? registro.n : 0) + 1;
    intentos.set(ip, { n, hasta: ahora + CASTIGO });
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  intentos.delete(ip);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...opcionesCookie, value: crearToken() });
  return res;
}
