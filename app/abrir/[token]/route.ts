import { NextRequest, NextResponse } from "next/server";
import { crearToken, enlaceCorrecto, opcionesCookie } from "@/lib/auth";

/* ============================================================
   El enlace mágico.

   Se abre una vez desde cada móvil:
     r-a-ai.vercel.app/abrir/<ACCESS_TOKEN>

   Deja la cookie puesta durante 10 años y redirige a la app.
   A partir de ahí no hay que volver a hacer nada nunca.

   Con enlace incorrecto responde exactamente igual que
   cualquier ruta bloqueada: no confirma ni desmiente que la
   dirección exista.
   ============================================================ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const destino = req.nextUrl.clone();
  destino.search = "";

  if (!enlaceCorrecto(token)) {
    destino.pathname = "/entrar";
    return NextResponse.redirect(destino);
  }

  destino.pathname = "/";
  const res = NextResponse.redirect(destino);
  res.cookies.set({ ...opcionesCookie, value: crearToken() });
  return res;
}
