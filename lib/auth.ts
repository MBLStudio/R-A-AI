import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

/* ============================================================
   Acceso a R&A — enlace mágico.

   No hay contraseña que escribir. Se abre una vez el enlace
   secreto (/abrir/<ACCESS_TOKEN>) desde cada móvil y la app
   queda desbloqueada en ese dispositivo durante 10 años.

   A cambio del enlace se emite una cookie httpOnly firmada con
   HMAC, que es lo que validan el proxy de base de datos y las
   rutas API. httpOnly = ni una XSS puede leerla.
   ============================================================ */

export const COOKIE = "ra_session";
const DIAS = 3650; // 10 años: en la práctica, para siempre

/** Secreto con el que se firma la cookie. */
function secreto(): string {
  return process.env.SESSION_SECRET || process.env.ACCESS_TOKEN || "";
}

/** ¿Está el acceso configurado? Si no, no cerramos la puerta. */
export function accesoConfigurado(): boolean {
  return Boolean(process.env.SESSION_SECRET || process.env.ACCESS_TOKEN);
}

/** Token de cookie = <emitido>.<firma>. La firma cubre el timestamp. */
export function crearToken(): string {
  const emitido = Date.now().toString(36);
  const firma = createHmac("sha256", secreto()).update(emitido).digest("hex");
  return `${emitido}.${firma}`;
}

export function tokenValido(token: string | undefined): boolean {
  if (!token || !secreto()) return false;

  const [emitido, firma] = token.split(".");
  if (!emitido || !firma) return false;

  const esperada = createHmac("sha256", secreto()).update(emitido).digest("hex");

  // Comparación en tiempo constante: no filtra nada por el tiempo de respuesta.
  const a = Buffer.from(firma, "hex");
  const b = Buffer.from(esperada, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const edad = Date.now() - parseInt(emitido, 36);
  return edad >= 0 && edad < DIAS * 86_400_000;
}

/** Para rutas API: ¿trae sesión válida esta petición? */
export function haySesion(req: NextRequest): boolean {
  return tokenValido(req.cookies.get(COOKIE)?.value);
}

/** Para Server Components. */
export async function haySesionServidor(): Promise<boolean> {
  const store = await cookies();
  return tokenValido(store.get(COOKIE)?.value);
}

/** ¿Es este el enlace bueno? Comparación en tiempo constante. */
export function enlaceCorrecto(token: string): boolean {
  const real = process.env.ACCESS_TOKEN;
  if (!real) return false;
  const a = createHmac("sha256", "cmp").update(token).digest();
  const b = createHmac("sha256", "cmp").update(real).digest();
  return timingSafeEqual(a, b);
}

export const opcionesCookie = {
  name: COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DIAS * 86_400,
};
