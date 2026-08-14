// ============================================================
// R&A — Permiso para subir un archivo grande
//
// Las fotos suben por /api/upload: el archivo pasa por nuestro
// servidor y de ahí a Supabase. Con un vídeo eso no vale, porque
// Vercel corta cualquier petición que pase de 4,5 MB y el vídeo
// más corto del iPhone ya son quince.
//
// Aquí no viaja el archivo: solo se firma un permiso de un rato
// para escribir en un sitio concreto del almacén. Con ese permiso
// el móvil sube directo a Supabase, sin pasar por Vercel, y deja
// de existir el problema del tamaño.
//
// La clave privada no sale de aquí, y el permiso sirve para una
// única ruta que decidimos nosotros: quien lo tenga no puede
// escribir en ningún otro sitio ni sobrescribir nada de antes.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "ra-photos";

/** El tope de Supabase en el plan gratuito. Ni firmamos si se pasa. */
const MAXIMO = 50 * 1024 * 1024;

/** Nada de rutas con trampa: solo letras, números y guiones. */
function carpetaLimpia(valor: unknown): string {
  const s = typeof valor === "string" ? valor : "";
  const limpia = s.replace(/[^a-zA-Z0-9_-]/g, "");
  return limpia || "misc";
}

/** La extensión del nombre original, si es de fiar. */
function extension(nombre: unknown): string {
  const s = typeof nombre === "string" ? nombre : "";
  const m = s.match(/\.([a-zA-Z0-9]{1,5})$/);
  return m ? m[1].toLowerCase() : "bin";
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, folder, tamano } = (await req.json()) as {
      nombre?: string;
      folder?: string;
      tamano?: number;
    };

    if (typeof tamano === "number" && tamano > MAXIMO) {
      return NextResponse.json(
        { error: "El archivo pasa del tamaño máximo.", maximo: MAXIMO },
        { status: 413 }
      );
    }

    const ruta = `${carpetaLimpia(folder)}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension(nombre)}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(ruta);

    if (error || !data) {
      console.error("[upload-url] Supabase:", error);
      return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 });
    }

    // La pública se puede calcular ya: el bucket es público y la
    // ruta la hemos decidido nosotros, así que no hace falta una
    // segunda vuelta al servidor cuando termine de subir.
    const { data: publica } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta);

    return NextResponse.json({
      ruta,
      token: data.token,
      url: publica.publicUrl,
    });
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }
}
