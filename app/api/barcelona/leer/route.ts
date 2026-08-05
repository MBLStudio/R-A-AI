import { NextRequest, NextResponse } from "next/server";
import { leerAnuncio } from "@/lib/barcelona/leerAnuncio";

/* ============================================================
   Lee un anuncio y devuelve lo que ha entendido.

   No guarda nada: la pantalla enseña la ficha, vosotros la
   corregís si hace falta y solo entonces se guarda.

   Ojo con la ruta: NO cuelga de /api/barcelona/pisos porque
   esa está exenta de sesión en proxy.ts (la usa la extensión
   con su token), y la exención vale para todo lo que hay
   debajo. Aquí sí queremos la cookie: este endpoint se
   descarga páginas de internet y no puede quedar abierto.
   ============================================================ */

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  let enlace: string;

  try {
    const cuerpo = (await req.json()) as { url?: string };
    enlace = (cuerpo?.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Falta el enlace." }, { status: 400 });
  }

  if (!enlace) {
    return NextResponse.json({ error: "Falta el enlace." }, { status: 400 });
  }

  // A veces se pega el enlace con texto alrededor (lo típico de WhatsApp:
  // "mira este piso https://…"). Nos quedamos con la dirección.
  const suelto = enlace.match(/https?:\/\/[^\s"'<>]+/);
  if (suelto) enlace = suelto[0];

  const resultado = await leerAnuncio(enlace);

  return NextResponse.json({
    ok: resultado.ok,
    motivo: resultado.ok ? null : resultado.motivo,
    anuncio: resultado.anuncio,
  });
}
