import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   Puerta de entrada de R&A (middleware de Next 16).

   Sin cookie de sesión válida no se llega a ninguna pantalla
   ni a ninguna ruta API, salvo las que se autentican por su
   cuenta (crons y la extensión, que usan Bearer).

   Verifica con Web Crypto porque el middleware corre en Edge,
   donde no existe el `crypto` de Node. La comprobación seria
   (tiempo constante) la repite /api/db, que sí es Node.
   ============================================================ */

const COOKIE = "ra_session";
const DIAS = 3650; // 10 años

/** Se autentican solas: no las tocamos. */
const SIN_SESION = [
  "/entrar",
  "/abrir/",                 // el enlace mágico valida su propio token
  "/api/auth/",
  "/api/db",                 // devuelve 401 JSON por su cuenta
  "/api/push/daily",         // cron (Bearer CRON_SECRET)
  "/api/cartas/check",       // cron (Bearer CRON_SECRET)
  "/api/barcelona/pisos",    // extensión (Bearer BARCELONA_INGEST_TOKEN)
];

async function tokenValido(token: string | undefined, secreto: string): Promise<boolean> {
  if (!token || !secreto) return false;

  const [emitido, firma] = token.split(".");
  if (!emitido || !firma) return false;

  const codificador = new TextEncoder();
  const clave = await crypto.subtle.importKey(
    "raw", codificador.encode(secreto),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const firmado = await crypto.subtle.sign("HMAC", clave, codificador.encode(emitido));
  const esperada = Array.from(new Uint8Array(firmado))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (firma !== esperada) return false;

  const edad = Date.now() - parseInt(emitido, 36);
  return edad >= 0 && edad < DIAS * 86_400_000;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (SIN_SESION.some((r) => pathname === r || pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const secreto = process.env.SESSION_SECRET || process.env.ACCESS_TOKEN || "";

  // Sin acceso configurado no cerramos la puerta: evita dejar
  // la app inaccesible por un despliegue a medias.
  if (!secreto) return NextResponse.next();

  if (await tokenValido(req.cookies.get(COOKIE)?.value, secreto)) {
    return NextResponse.next();
  }

  // A las APIs se les responde en JSON; el fetch no sabe leer un redirect a HTML.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/entrar";
  login.search = `?volver=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Todo menos:
     *  - _next/static, _next/image  (build)
     *  - favicon, sw.js, manifest   (PWA)
     *  - cualquier archivo con extensión (imágenes, iconos…)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.[\\w]+$).*)",
  ],
};
