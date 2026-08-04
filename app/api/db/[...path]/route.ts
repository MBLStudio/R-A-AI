import { NextRequest, NextResponse } from "next/server";
import { haySesion, accesoConfigurado } from "@/lib/auth";

/* ============================================================
   Proxy autenticado a Supabase.

   El navegador cree que habla con Supabase; en realidad habla
   con nosotros. Aquí comprobamos la cookie de sesión y, solo
   entonces, reenviamos la petición con la service_role key.

   Resultado: las tablas quedan cerradas a cal y canto con RLS,
   y la única forma de tocarlas desde fuera es tener la cookie.
   ============================================================ */

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Solo dejamos pasar lo que la app usa de verdad. */
const PERMITIDO = ["rest", "storage"];

/** Cabeceras del cliente que sí tienen sentido reenviar. */
const CABECERAS_ENTRADA = [
  "content-type", "accept", "accept-profile", "content-profile",
  "prefer", "range", "x-upsert", "cache-control",
];

/** Cabeceras de Supabase que devolvemos al cliente. */
const CABECERAS_SALIDA = [
  "content-type", "content-range", "range-unit", "preference-applied", "etag",
];

async function reenviar(req: NextRequest, segmentos: string[]) {
  if (!SUPABASE || !SERVICE) {
    return NextResponse.json({ error: "Supabase sin configurar" }, { status: 503 });
  }

  // Mismo criterio que proxy.ts: sin acceso configurado no cerramos la
  // puerta. Si no, un despliegue sin variables dejaría la app inservible —
  // y en ese estado no protege menos que antes, porque RLS aún no está activo.
  if (accesoConfigurado() && !haySesion(req)) {
    return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  }

  if (segmentos.length === 0 || !PERMITIDO.includes(segmentos[0])) {
    return NextResponse.json({ error: "Ruta no permitida" }, { status: 403 });
  }

  const destino = `${SUPABASE}/${segmentos.join("/")}${new URL(req.url).search}`;

  const cabeceras = new Headers();
  for (const h of CABECERAS_ENTRADA) {
    const v = req.headers.get(h);
    if (v) cabeceras.set(h, v);
  }
  // Las credenciales las ponemos nosotros; lo que mande el cliente se ignora.
  cabeceras.set("apikey", SERVICE);
  cabeceras.set("Authorization", `Bearer ${SERVICE}`);

  const conCuerpo = !["GET", "HEAD"].includes(req.method);

  const respuesta = await fetch(destino, {
    method: req.method,
    headers: cabeceras,
    body: conCuerpo ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  });

  const salida = new Headers();
  for (const h of CABECERAS_SALIDA) {
    const v = respuesta.headers.get(h);
    if (v) salida.set(h, v);
  }
  salida.set("Cache-Control", "no-store");

  return new NextResponse(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: salida,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
export async function HEAD(req: NextRequest, { params }: Ctx) {
  return reenviar(req, (await params).path);
}
