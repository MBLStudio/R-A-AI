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
