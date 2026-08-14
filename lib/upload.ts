// ============================================================
// R&A — Subir una foto
//
// Antes de mandarla, se encoge en el propio móvil.
//
// Y no es un capricho: una foto de iPhone pesa entre 3 y 5 MB,
// y el servidor corta las subidas en 4,5. Las que se pasaban
// fallaban sin decir nada, así que unas fotos entraban y otras
// no según lo que hubiera salido en la cámara.
//
// A 3200 píxeles se queda sobre un mega: entra de sobra, sube
// rápido y aguanta el zoom hasta casi tres aumentos, que es lo
// que se usa de verdad al mirar una cara de cerca.
// ============================================================

const LADO_MAXIMO = 3200;
const CALIDAD = 0.88;

/** Fotos ya pequeñas, gifs y demás: no vale la pena tocarlas. */
const NO_TOCAR = 1_400 * 1024;

async function encoger(file: File): Promise<File> {
  if (file.size <= NO_TOCAR) return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    // «from-image» es la clave de que la foto no salga tumbada.
    //
    // El móvil no gira la foto al hacerla: la guarda como salió del
    // sensor y le pega una nota que dice cómo hay que darle la vuelta.
    // Al pasarla por el lienzo esa nota se pierde, así que hay que
    // pedir que la aplique antes. Luego se exporta ya derecha y sin
    // nota, que es a prueba de todo.
    const imagen = await createImageBitmap(file, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));

    // Ya cabe: si aun así pesa, la recomprimimos igual
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;

    const pincel = lienzo.getContext("2d");
    if (!pincel) return file;
    pincel.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close?.();

    const blob = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, "image/jpeg", CALIDAD)
    );
    if (!blob || blob.size >= file.size) return file;

    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Formatos raros del iPhone y demás: se sube tal cual y ya avisará
    return file;
  }
}

/**
 * Cuándo se hizo la foto.
 *
 * El iPhone borra de la foto el sitio donde se tomó, pero deja la fecha.
 * Sirve para saber si lo que se está subiendo es de ahora o de hace días,
 * que es la diferencia entre poner bien un momento en el mapa o mandarlo
 * a doce kilómetros de donde fue.
 *
 * Se lee del principio del archivo sin descomprimir nada: la fecha va en
 * texto plano dentro de los datos de la cámara.
 */
export async function fechaDeLaFoto(file: File): Promise<Date | null> {
  try {
    const trozo = await file.slice(0, 128 * 1024).arrayBuffer();
    const texto = new TextDecoder("latin1").decode(trozo);
    const m = texto.match(/(20\d\d):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
    if (!m) return null;

    const fecha = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (Number.isNaN(fecha.getTime())) return null;

    // Una fecha absurda es un falso positivo del texto
    const ahora = Date.now();
    if (fecha.getTime() > ahora + 86_400_000) return null;
    if (fecha.getFullYear() < 2015) return null;
    return fecha;
  } catch {
    return null;
  }
}

export interface ResultadoSubida {
  url: string | null;
  error: string | null;
}

/** Sube la foto y cuenta qué ha pasado. */
export async function subirFoto(file: File, folder: string): Promise<ResultadoSubida> {
  let foto: File;
  try {
    foto = await encoger(file);
  } catch {
    foto = file;
  }

  // Aun encogida, si sigue siendo enorme no llegará: mejor decirlo
  if (foto.size > 4 * 1024 * 1024) {
    return {
      url: null,
      error: "La foto pesa demasiado y no hemos podido encogerla. Probad con otra.",
    };
  }

  try {
    const formData = new FormData();
    formData.append("file", foto);
    formData.append("folder", folder);

    const res = await fetch("/api/upload", { method: "POST", body: formData });

    if (!res.ok) {
      if (res.status === 413) {
        return { url: null, error: "La foto es demasiado grande para subirla." };
      }
      const detalle = await res.json().catch(() => null);
      return { url: null, error: detalle?.error ?? "No hemos podido subir la foto." };
    }

    const { url } = await res.json();
    return url
      ? { url, error: null }
      : { url: null, error: "El servidor no ha devuelto la foto." };
  } catch {
    return { url: null, error: "Sin conexión. Inténtalo otra vez." };
  }
}

/** La de siempre, para lo que ya la usaba. */
export async function uploadPhoto(file: File, folder: string): Promise<string | null> {
  const { url } = await subirFoto(file, folder);
  return url;
}

/* ═══════════════════════════════════════════════════════════
   Vídeos

   Un vídeo no puede pasar por nuestro servidor: Vercel corta a
   los 4,5 MB y el más corto del iPhone ya son quince. Así que va
   directo a Supabase con un permiso firmado, y el tope pasa a ser
   el del almacén: 50 MB, que son unos 20-30 segundos en 1080p.

   Tampoco se puede encoger antes, como hacemos con las fotos: en
   el navegador no hay nada que recomprima vídeo sin descargarse
   medio programa. Por eso, cuando no entra, lo único honesto es
   decirlo con el peso delante y no dejar que falle a medias.
   ═══════════════════════════════════════════════════════════ */

const MAXIMO_VIDEO = 50 * 1024 * 1024;

export function esVideo(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|3gp)$/i.test(file.name);
}

const enMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

export async function subirVideo(file: File, folder: string): Promise<ResultadoSubida> {
  if (file.size > MAXIMO_VIDEO) {
    return {
      url: null,
      error: `El vídeo pesa ${enMB(file.size)} MB y el tope son ${enMB(MAXIMO_VIDEO)}. Probad con uno más corto: unos 20 o 30 segundos entran de sobra.`,
    };
  }

  try {
    // 1. Pedimos permiso para escribir en un sitio concreto
    const permiso = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: file.name, folder, tamano: file.size }),
    });

    if (!permiso.ok) {
      const detalle = await permiso.json().catch(() => null);
      return { url: null, error: detalle?.error ?? "No hemos podido preparar la subida." };
    }

    const { ruta, token, url } = (await permiso.json()) as {
      ruta: string; token: string; url: string;
    };

    // 2. El vídeo va del móvil a Supabase sin escala
    const { createClient } = await import("@supabase/supabase-js");
    const almacen = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error } = await almacen.storage
      .from("ra-photos")
      .uploadToSignedUrl(ruta, token, file, { contentType: file.type || "video/mp4" });

    if (error) {
      const dice = error.message.toLowerCase();
      if (dice.includes("exceeded") || dice.includes("maximum")) {
        return { url: null, error: `El vídeo es demasiado grande. El tope son ${enMB(MAXIMO_VIDEO)} MB.` };
      }
      return { url: null, error: "No hemos podido subir el vídeo. Inténtalo otra vez." };
    }

    return { url, error: null };
  } catch {
    return { url: null, error: "Sin conexión. Inténtalo otra vez." };
  }
}

/** Foto o vídeo, lo que sea que hayan elegido. */
export async function subirMedia(file: File, folder: string): Promise<ResultadoSubida> {
  return esVideo(file) ? subirVideo(file, folder) : subirFoto(file, folder);
}

/** Si una URL guardada es un vídeo, para saber cómo pintarla. */
export function urlEsVideo(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|avi|3gp)(\?|$)/i.test(url);
}
