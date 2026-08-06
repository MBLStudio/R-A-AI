// ============================================================
// R&A — Leer un anuncio de piso a partir de su enlace
//
// Le das la dirección de un anuncio y devuelve el piso ya
// masticado: precio, metros, habitaciones, barrio y fotos.
//
// Va probando por orden, de lo más fiable a lo más apañado:
//
//   1. La ficha estructurada (JSON-LD). Los portales la
//      publican para que Google entienda el anuncio, así que
//      la cuidan y casi nunca la cambian.
//   2. Las etiquetas de compartir (Open Graph). Son las que
//      hacen que salga la foto bonita en WhatsApp. También
//      muy estables.
//   3. Rebuscar en el texto. El último recurso.
//
// Lo que no se pueda leer se devuelve en `faltan`, para que
// la pantalla lo pida a mano en vez de inventárselo.
// ============================================================

export interface AnuncioLeido {
  url: string;
  portal: string;
  portal_id: string | null;
  titulo: string | null;
  precio: number | null;
  m2: number | null;
  habitaciones: number | null;
  banos: number | null;
  planta: string | null;
  ascensor: boolean | null;
  amueblado: boolean | null;
  exterior: boolean | null;
  direccion: string | null;
  barrio: string | null;
  fotos: string[];
  descripcion: string | null;
  /** De dónde salió lo que traemos. */
  fuente: "ficha" | "compartir" | "texto" | "nada";
  /** Lo que no se ha podido leer y hay que poner a mano. */
  faltan: string[];
}

export type ResultadoLectura =
  | { ok: true; anuncio: AnuncioLeido }
  | { ok: false; motivo: string; anuncio: AnuncioLeido };

/* ─── Portales que sabemos nombrar ──────────────────────────── */

const PORTALES: { patron: string; nombre: string }[] = [
  { patron: "idealista", nombre: "idealista" },
  { patron: "fotocasa", nombre: "fotocasa" },
  { patron: "habitaclia", nombre: "habitaclia" },
  { patron: "pisos.com", nombre: "pisos" },
  { patron: "enalquiler", nombre: "enalquiler" },
  { patron: "yaencontre", nombre: "yaencontre" },
  { patron: "spotahome", nombre: "spotahome" },
  { patron: "rentumo", nombre: "rentumo" },
  { patron: "milanuncios", nombre: "milanuncios" },
  { patron: "badi.com", nombre: "badi" },
  { patron: "housinganywhere", nombre: "housinganywhere" },
  { patron: "uniplaces", nombre: "uniplaces" },
  { patron: "trovit", nombre: "trovit" },
  { patron: "nuroa", nombre: "nuroa" },
  { patron: "airbnb", nombre: "airbnb" },
];

export function nombrePortal(host: string): string {
  const h = host.toLowerCase();
  return PORTALES.find((p) => h.includes(p.patron))?.nombre ?? h.replace(/^www\./, "");
}

/** El número del anuncio dentro del portal, para no guardarlo dos veces. */
function idDelAnuncio(url: string, portal: string): string | null {
  const patrones: Record<string, RegExp> = {
    idealista: /\/inmueble\/(\d+)/,
    fotocasa: /\/(\d{6,})(?:\/|\?|$)/,
    habitaclia: /-i(\d+)(?:\.|$)/,
    pisos: /\/(\d{5,})(?:\/|\?|$)/,
    enalquiler: /\/(\d{5,})(?:\/|\?|$)/,
    yaencontre: /\/(\d{5,})(?:\/|\?|$)/,
    spotahome: /\/(\d{4,})(?:\/|\?|$)/,
    milanuncios: /\/(\d{6,})(?:\/|\?|$)/,
    badi: /\/room\/([\w-]+)/,
  };
  const patron = patrones[portal];
  if (patron) {
    const m = url.match(patron);
    if (m) return m[1];
  }
  // Cualquier tirada larga de dígitos en la ruta sirve como identificador
  const generico = url.split("?")[0].match(/(\d{5,})/);
  return generico ? generico[1] : null;
}

/* ─── Seguridad: que nadie use esto para husmear ────────────── */

const HOSTS_PROHIBIDOS = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

function urlValida(entrada: string): URL | null {
  try {
    const u = new URL(entrada.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (HOSTS_PROHIBIDOS.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

/* ─── Descargar la página ───────────────────────────────────── */

/**
 * Con quién nos presentamos, por orden.
 *
 * Primero un navegador normal. Si nos cierran la puerta, probamos como los
 * bots que generan la vista previa de los enlaces: a esos los portales sí
 * los dejan pasar, porque les interesa que sus anuncios se vean bien
 * cuando alguien los comparte por WhatsApp. Es la puerta de servicio.
 */
const AGENTES = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "WhatsApp/2.23.20.0 A",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "TelegramBot (like TwitterBot)",
];

const CABECERAS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,ca;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

/** ¿Esto es una ficha de piso o la pantalla de «no eres humano»? */
function pareceUnAnuncio(html: string): boolean {
  return html.length > 5_000 && /og:image|og:title|<img|application\/ld\+json/i.test(html);
}

type Intento = { html: string } | { fallo: string; definitivo?: boolean };

async function unIntento(url: string, agente: string): Promise<Intento> {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 11_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": agente, ...CABECERAS },
      redirect: "follow",
      signal: corte.signal,
    });
    if (res.status === 404 || res.status === 410) {
      return { fallo: "Ese anuncio ya no existe.", definitivo: true };
    }
    if (!res.ok) {
      // 403, 405, 429, 503… todos significan lo mismo: no eres bienvenido.
      // Merece la pena volver a llamar presentándonos de otra manera.
      return { fallo: `El portal no nos deja leer el anuncio (error ${res.status}).` };
    }
    const tipo = res.headers.get("content-type") ?? "";
    if (!tipo.includes("html")) {
      return { fallo: "Ese enlace no lleva a un anuncio.", definitivo: true };
    }
    return { html: await res.text() };
  } catch (e) {
    const abortado = e instanceof Error && e.name === "AbortError";
    return { fallo: abortado ? "El portal ha tardado demasiado." : "No se ha podido abrir el enlace." };
  } finally {
    clearTimeout(reloj);
  }
}

async function descargar(url: string): Promise<{ html: string } | { fallo: string }> {
  let ultimoFallo = "El portal no nos deja leer el anuncio desde aquí.";

  for (const agente of AGENTES) {
    const intento = await unIntento(url, agente);
    if ("html" in intento) {
      if (pareceUnAnuncio(intento.html)) return intento;
      ultimoFallo = "El portal nos ha devuelto una página vacía.";
      continue;
    }
    ultimoFallo = intento.fallo;
    // Un anuncio borrado o un enlace que no es un anuncio no mejoran
    // por insistir; un bloqueo, a veces sí.
    if (intento.definitivo) break;
  }

  return { fallo: ultimoFallo };
}

/* ─── Ayudas de texto ───────────────────────────────────────── */

function limpiar(texto: string): string {
  return texto
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, "'")
    .replace(/&lt;|&#60;/gi, "<")
    .replace(/&gt;|&#62;/gi, ">")
    .replace(/&ordm;|&#186;/gi, "º")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Un número de un texto tipo "2.600 €" o "62,5 m²".
 *
 * Aquí está el matiz que importa: en España el punto separa los miles, así
 * que "2.600" son dos mil seiscientos, no dos coma seis. Distinguirlos es
 * mirar si detrás del separador vienen exactamente tres cifras.
 */
function aNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;

  const limpio = valor.replace(/[^\d.,]/g, "");
  if (!limpio) return null;

  const hayComa = limpio.includes(",");
  const hayPunto = limpio.includes(".");
  let normal: string;

  if (hayComa && hayPunto) {
    // El separador decimal es el último que aparece
    normal =
      limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio.replace(/,/g, "");
  } else if (hayPunto) {
    // "2.600" → miles   ·   "62.5" → decimal
    normal = /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, "") : limpio;
  } else if (hayComa) {
    // "2,600" → miles   ·   "62,5" → decimal
    normal = /^\d{1,3}(,\d{3})+$/.test(limpio) ? limpio.replace(/,/g, "") : limpio.replace(",", ".");
  } else {
    normal = limpio;
  }

  const n = parseFloat(normal);
  return Number.isFinite(n) ? n : null;
}

function precioRazonable(n: number | null): number | null {
  return n !== null && n >= 100 && n <= 20_000 ? Math.round(n) : null;
}

/** Una etiqueta <meta>, venga como venga el orden de sus atributos. */
function meta(html: string, clave: string): string | null {
  const escapada = clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const delante = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapada}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const detras = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapada}["']`,
    "i"
  );
  const m = html.match(delante) ?? html.match(detras);
  return m ? limpiar(m[1]) : null;
}

/** El texto de la página, sin código ni etiquetas. */
function soloTexto(html: string): string {
  return limpiar(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

/* ─── 1. La ficha estructurada (JSON-LD) ────────────────────── */

type Dato = Record<string, unknown>;

function esObjeto(v: unknown): v is Dato {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Saca todos los objetos del JSON-LD, incluidos los anidados en @graph. */
function fichasDe(html: string): Dato[] {
  const encontrados: Dato[] = [];
  const bloques = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const bloque of bloques) {
    let contenido: unknown;
    try {
      contenido = JSON.parse(bloque[1].trim());
    } catch {
      continue;
    }
    const pendientes: unknown[] = [contenido];
    let vueltas = 0;
    while (pendientes.length && vueltas++ < 400) {
      const actual = pendientes.shift();
      if (Array.isArray(actual)) {
        pendientes.push(...actual);
      } else if (esObjeto(actual)) {
        encontrados.push(actual);
        if (Array.isArray(actual["@graph"])) pendientes.push(...(actual["@graph"] as unknown[]));
        for (const clave of ["offers", "mainEntity", "about", "itemOffered", "item"]) {
          if (actual[clave]) pendientes.push(actual[clave]);
        }
      }
    }
  }
  return encontrados;
}

/** Busca una clave en una lista de fichas, la primera que la tenga. */
function campo(fichas: Dato[], ...claves: string[]): unknown {
  for (const clave of claves) {
    for (const f of fichas) {
      const v = f[clave];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
}

/** Los valores de JSON-LD vienen a veces como { value: 62, unitCode: "MTK" }. */
function valorDe(v: unknown): number | null {
  if (esObjeto(v)) return aNumero(v.value ?? v.maxValue ?? v.minValue);
  return aNumero(v);
}

function textoDe(v: unknown): string | null {
  if (typeof v === "string") return limpiar(v) || null;
  if (esObjeto(v)) {
    const n = v.name ?? v.streetAddress;
    if (typeof n === "string") return limpiar(n) || null;
  }
  return null;
}

/** Iconos, logos y banderitas: no son fotos del piso. */
const NO_ES_FOTO =
  /favicon|logo|sprite|placeholder|banner|avatar|badge|\.svg(\?|$)|\/icons?\/|\/assets\/|\/static\/(?:js|css)\//i;

/**
 * Las fotos del piso, rebuscadas en la página entera.
 *
 * La etiqueta de compartir solo trae la portada, pero un anuncio tiene
 * veinte fotos y son media decisión. Casi todas cuelgan del mismo sitio
 * que la portada, así que la usamos de guía: nos quedamos con las que
 * comparten servidor con ella y descartamos el resto.
 */
function fotosDelHtml(html: string, portada: string | null): string[] {
  const patron = /https?:(?:\\?\/){2}[^\s"'<>\\)]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>\\)]*)?/gi;

  const todas = [...html.matchAll(patron)]
    .map((m) => m[0].replace(/\\\//g, "/"))
    .filter((u) => !NO_ES_FOTO.test(u));

  let candidatas = todas;

  // Si sabemos de qué servidor sale la portada, nos ceñimos a él
  if (portada) {
    try {
      const casa = new URL(portada).host;
      const mismas = todas.filter((u) => {
        try { return new URL(u).host === casa; } catch { return false; }
      });
      if (mismas.length) candidatas = mismas;
    } catch { /* portada rara: seguimos con todas */ }
  }

  // Un anuncio serio no repite la misma foto en versiones de 90 píxeles
  const buenas = candidatas.filter((u) => !/\b(?:thumb|mini|small|60x|90x|120x)\b/i.test(u));

  return [...new Set(buenas.length ? buenas : candidatas)].slice(0, 12);
}

function imagenesDe(v: unknown, tope = 8): string[] {
  const salida: string[] = [];
  const meter = (x: unknown) => {
    if (salida.length >= tope) return;
    const url = typeof x === "string" ? x : esObjeto(x) && typeof x.url === "string" ? x.url : null;
    if (url && /^https?:\/\//.test(url) && !NO_ES_FOTO.test(url)) salida.push(url);
  };
  if (Array.isArray(v)) v.forEach(meter);
  else meter(v);
  return [...new Set(salida)];
}

/* ─── 2. Rebuscar en el texto ───────────────────────────────── */

function precioDelTexto(texto: string): number | null {
  const cerca =
    texto.match(/(\d[\d.,]{2,8})\s*€\s*(?:\/|al\s+)?\s*mes/i) ??
    texto.match(/(\d[\d.,]{2,8})\s*€\s*\/\s*m(?:es|onth)/i) ??
    texto.match(/alquiler[^\d€]{0,30}(\d[\d.,]{2,8})\s*€/i) ??
    texto.match(/(\d[\d.,]{2,8})\s*(?:€|eur)/i);
  return cerca ? precioRazonable(aNumero(cerca[1])) : null;
}

function metrosDelTexto(texto: string): number | null {
  // Ojo: nada de \b detrás de "m²" — el ² no cuenta como letra y el límite
  // de palabra nunca se cumple, así que "75 m²" no casaba.
  const m =
    texto.match(/(\d{2,4})\s*m(?:²|²)/i) ??
    texto.match(/(\d{2,4})\s*m2(?![\d\w])/i) ??
    texto.match(/(\d{2,4})\s*metros\s+cuadrados/i) ??
    texto.match(/superficie[^\d]{0,20}(\d{2,4})/i);
  const n = m ? aNumero(m[1]) : null;
  return n !== null && n >= 10 && n <= 1000 ? Math.round(n) : null;
}

function habitacionesDelTexto(texto: string): number | null {
  const m =
    texto.match(/(\d{1,2})\s*(?:hab\.?|habitacion|dormitor|bedroom)/i) ??
    texto.match(/(?:hab\.?|habitaciones|dormitorios)\s*:?\s*(\d{1,2})/i);
  const n = m ? aNumero(m[1]) : null;
  return n !== null && n >= 0 && n <= 15 ? Math.round(n) : null;
}

function banosDelTexto(texto: string): number | null {
  const m =
    texto.match(/(\d{1,2})\s*(?:baños?|banys?|bathroom|aseos?)/i) ??
    texto.match(/(?:baños|banys|bathrooms)\s*:?\s*(\d{1,2})/i);
  const n = m ? aNumero(m[1]) : null;
  return n !== null && n >= 0 && n <= 10 ? Math.round(n) : null;
}

/**
 * Los extras (ascensor, amueblado…) van en la ficha de características como
 * pares «Ascensor Sí» / «Amueblado No». Hay que leer la respuesta, no solo
 * ver si la palabra aparece: en la página aparece siempre, y dábamos por
 * amueblado un piso cuya ficha decía justo lo contrario.
 */
function deLaFicha(texto: string, etiquetas: string[]): boolean | null {
  for (const etiqueta of etiquetas) {
    // Sin \b al final: las vocales acentuadas no cuentan como letra para el
    // motor de expresiones, y «Sí» se quedaba fuera. El lookahead hace el
    // trabajo de verdad — evita que «no» cace con «norte» o «nos».
    const m = texto.match(new RegExp(`\\b${etiqueta}\\s*:?\\s+(s[íi]|no)(?![a-zñáéíóúü])`, "i"));
    if (m) return /^s/i.test(m[1]);
  }
  return null;
}

/**
 * Si la ficha no lo dice, lo buscamos en la descripción que escribió el
 * anunciante — nunca en la página entera, que está llena de filtros y menús
 * que dan falsos positivos.
 */
function deLaDescripcion(desc: string | null, siHay: RegExp, siNoHay?: RegExp): boolean | null {
  if (!desc) return null;
  if (siNoHay && siNoHay.test(desc)) return false;
  if (siHay.test(desc)) return true;
  return null;
}

/* ─── El lector ─────────────────────────────────────────────── */

function vacio(url: string, portal: string): AnuncioLeido {
  return {
    url,
    portal,
    portal_id: null,
    titulo: null,
    precio: null,
    m2: null,
    habitaciones: null,
    banos: null,
    planta: null,
    ascensor: null,
    amueblado: null,
    exterior: null,
    direccion: null,
    barrio: null,
    fotos: [],
    descripcion: null,
    fuente: "nada",
    faltan: ["titulo", "precio", "m2", "habitaciones"],
  };
}

/**
 * @param enlace   la dirección del anuncio
 * @param htmlDado la página ya descargada. Los portales grandes bloquean
 *   las peticiones que salen de un servidor, así que cuando quien comparte
 *   el piso puede descargarla él (el móvil, el navegador), nos la manda y
 *   aquí solo la interpretamos. Es la única forma de que esto funcione con
 *   Idealista y Fotocasa.
 */
export async function leerAnuncio(enlace: string, htmlDado?: string): Promise<ResultadoLectura> {
  const url = urlValida(enlace);
  if (!url) {
    return { ok: false, motivo: "Eso no parece un enlace válido.", anuncio: vacio(enlace, "manual") };
  }

  const portal = nombrePortal(url.hostname);
  const limpio = url.toString();
  const base = vacio(limpio, portal);
  base.portal_id = idDelAnuncio(limpio, portal);

  let html: string;
  if (htmlDado && htmlDado.length > 500) {
    html = htmlDado;
  } else {
    const bajada = await descargar(limpio);
    if ("fallo" in bajada) {
      return { ok: false, motivo: bajada.fallo, anuncio: base };
    }
    html = bajada.html;
  }
  const fichas = fichasDe(html);
  const texto = soloTexto(html).slice(0, 20_000);

  // Los portales ponen la ficha del piso arriba del todo («860 € /mes ·
  // 3 habs. · 1 baño · 75 m²»). Buscar ahí primero evita colarse con los
  // números de otro anuncio de la barra lateral.
  const cabecera = texto.slice(0, 2_500);
  const primero = <T,>(fn: (t: string) => T | null): T | null => fn(cabecera) ?? fn(texto);

  // ── Precio ────────────────────────────────────────────────
  let precio = precioRazonable(
    valorDe(campo(fichas, "price", "lowPrice")) ??
      valorDe(esObjeto(campo(fichas, "priceSpecification")) ? (campo(fichas, "priceSpecification") as Dato).price : null)
  );
  let fuente: AnuncioLeido["fuente"] = precio !== null ? "ficha" : "nada";

  if (precio === null) {
    const deCompartir = meta(html, "product:price:amount") ?? meta(html, "og:price:amount");
    precio = precioRazonable(aNumero(deCompartir));
    if (precio !== null) fuente = "compartir";
  }
  if (precio === null) {
    precio = primero(precioDelTexto);
    if (precio !== null) fuente = "texto";
  }

  // ── Metros, habitaciones, baños ───────────────────────────
  const m2 = valorDe(campo(fichas, "floorSize", "size")) ?? primero(metrosDelTexto);

  const habitaciones =
    valorDe(campo(fichas, "numberOfBedrooms", "numberOfRooms")) ?? primero(habitacionesDelTexto);

  const banos =
    valorDe(campo(fichas, "numberOfBathroomsTotal", "numberOfBathrooms")) ?? primero(banosDelTexto);

  // ── Título y descripción ──────────────────────────────────
  // Los portales titulan fatal: «Piso de alquiler en N/a, La Prosperitat,
  // Barcelona Capital | fotocasa». Nos quedamos con lo que dice algo.
  let titulo: string | null =
    meta(html, "og:title") ??
    textoDe(campo(fichas, "name", "headline")) ??
    limpiar(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") ??
    null;

  // Si la página nos llega ya convertida a texto —los Atajos del iPhone lo
  // hacen— no queda ni una etiqueta. El título sigue ahí dentro, pero no al
  // principio: delante va el menú («Buscar Publica +13 fotos…»). Hay que
  // buscar la frase, no los primeros caracteres.
  if (!titulo || titulo.length < 4) {
    const frase = texto.match(
      /((?:piso|[áa]tico|casa|estudio|apartamento|d[úu]plex|loft|chalet|habitaci[óo]n)\s+(?:de\s+)?(?:alquiler|venta)?\s*en\s+.{4,80}?barcelona(?:\s+capital)?)/i
    );
    if (frase) titulo = frase[1].trim();
  }

  // Guardamos el título tal cual venía: el barrio se saca de él, y ahí
  // todavía están las comas y la ciudad que luego quitamos.
  const tituloCrudo = titulo;

  if (titulo) {
    titulo = titulo
      .replace(/\s*[|·–—-]\s*(fotocasa|idealista|habitaclia|pisos\.com|milanuncios|enalquiler|yaencontre|spotahome|rentumo)\b.*$/i, "")
      .replace(/\bn\/a\b[,\s]*/gi, "")
      .replace(/\s*,\s*(?=,)/g, "")
      .replace(/^[\s,·-]+|[\s,·-]+$/g, "")
      .replace(/[,\s]+barcelona\s*(capital)?\s*$/i, "")
      .trim();
    if (titulo.length < 4) titulo = null;
  }

  let descripcion =
    textoDe(campo(fichas, "description")) ?? meta(html, "og:description") ?? meta(html, "description");

  // En texto plano, lo que el anunciante escribió va justo detrás del título
  if (!descripcion && tituloCrudo) {
    const donde = texto.indexOf(tituloCrudo);
    if (donde >= 0) {
      const cola = texto.slice(donde + tituloCrudo.length).trim();
      if (cola.length > 40) descripcion = cola.slice(0, 900);
    }
  }

  // ── Dónde está ────────────────────────────────────────────
  const direccionFicha = campo(fichas, "address");
  let direccion: string | null = null;
  let barrio: string | null = null;
  if (esObjeto(direccionFicha)) {
    direccion = textoDe(direccionFicha.streetAddress) ?? null;
    barrio =
      textoDe(direccionFicha.addressLocality) ??
      textoDe(direccionFicha.addressRegion) ??
      textoDe(direccionFicha.addressNeighborhood) ??
      null;
  } else if (typeof direccionFicha === "string") {
    direccion = limpiar(direccionFicha) || null;
  }
  if (!direccion && titulo) direccion = titulo;

  // Los portales suelen titular «… en Carrer de Verdi, Vila de Gràcia, Barcelona».
  // El barrio es lo que va justo antes de la ciudad, y nos hace falta para
  // cruzarlo con vuestras valoraciones.
  const quitarTipo = (t: string) =>
    t
      .replace(
        /^(?:piso|[áa]tico|casa|estudio|apartamento|d[úu]plex|loft|chalet|habitaci[óo]n|local)?\s*(?:de\s+)?(?:alquiler|venta)?\s*(?:en|a)\s+/i,
        ""
      )
      .trim();

  const barrioValido = (c: string) =>
    c.length > 2 && !/^\d+$/.test(c) && !/^n\/a$/i.test(c) && !/^barcelona/i.test(c);

  if (!barrio && tituloCrudo) {
    const trozos = tituloCrudo.split(",").map((t) => t.trim()).filter(Boolean);
    const ultimo = trozos[trozos.length - 1] ?? "";

    if (/barcelona/i.test(ultimo)) {
      // «…Comtes de Bell-lloc, Sants Barcelona Capital» → el barrio va
      // pegado a la ciudad, sin coma. Le quitamos la ciudad y ahí está.
      const pegado = quitarTipo(ultimo.replace(/\s*barcelona(\s+capital)?\s*$/i, "").trim());
      if (barrioValido(pegado)) {
        barrio = pegado;
      } else if (trozos.length >= 2) {
        // «…N/a, La Prosperitat, Barcelona Capital» → va en su propio trozo
        const suelto = quitarTipo(trozos[trozos.length - 2]);
        if (barrioValido(suelto)) barrio = suelto;
      }
    }
  }

  // Y si el título ya viene limpio y sin comas —«Piso de alquiler en La
  // Prosperitat»—, el barrio es lo que va detrás del «en».
  if (!barrio && titulo) {
    const candidato = quitarTipo(titulo);
    if (candidato !== titulo && barrioValido(candidato)) barrio = candidato;
  }

  // ── Fotos ─────────────────────────────────────────────────
  const portada = meta(html, "og:image");
  const fotos = imagenesDe(campo(fichas, "image", "photo"));
  if (portada && !NO_ES_FOTO.test(portada) && !fotos.includes(portada)) fotos.unshift(portada);

  // La ficha rara vez trae más de una: el resto hay que buscarlas
  for (const foto of fotosDelHtml(html, portada ?? fotos[0] ?? null)) {
    if (!fotos.includes(foto)) fotos.push(foto);
  }

  // ── Los extras ────────────────────────────────────────────
  // Primero la ficha de características («Ascensor Sí»), que es un dato;
  // si no la hay, lo que contó el anunciante. Nunca la página entera.
  const ascensor =
    deLaFicha(texto, ["ascensor"]) ??
    deLaDescripcion(descripcion, /\bcon ascensor\b/i, /\bsin ascensor\b/i);

  const amueblado =
    deLaFicha(texto, ["amueblado", "moblat", "furnished"]) ??
    deLaDescripcion(
      descripcion,
      /\bamueblad[oa]\b|\bmoblat\b|\bfurnished\b/i,
      /\bsin amueblar\b|\bno amueblad|\bsin muebles\b/i
    );

  const exterior =
    deLaFicha(texto, ["exterior"]) ??
    deLaDescripcion(descripcion, /\bexterior\b/i, /\binterior\b/i);

  const planta =
    texto.match(/\bplanta\s*:?\s*(\d{1,2}\s*ª?|bajo|entresuelo|principal|[áa]tico)\b/i)?.[1]?.trim() ??
    null;

  if (fuente === "nada" && (m2 !== null || habitaciones !== null)) fuente = fichas.length ? "ficha" : "texto";
  if (fuente === "nada" && titulo) fuente = "compartir";

  // Si después de limpiar no queda título, lo escribimos nosotros con lo
  // que sí sabemos. Vale más «Piso en Gràcia · 75 m²» que «Piso por revisar».
  if (!titulo) {
    const piezas = [
      habitaciones ? `Piso de ${habitaciones} hab` : "Piso",
      barrio ? `en ${barrio}` : null,
      !barrio && m2 ? `de ${m2} m²` : null,
    ].filter(Boolean);
    titulo = piezas.join(" ");
  }

  const anuncio: AnuncioLeido = {
    ...base,
    titulo: titulo || null,
    precio,
    m2: m2 !== null ? Math.round(m2) : null,
    habitaciones: habitaciones !== null ? Math.round(habitaciones) : null,
    banos: banos !== null ? Math.round(banos) : null,
    planta,
    ascensor,
    amueblado,
    exterior,
    direccion,
    barrio,
    fotos: fotos.slice(0, 12),
    descripcion: descripcion ? descripcion.slice(0, 1200) : null,
    fuente,
    faltan: [],
  };

  anuncio.faltan = (["titulo", "precio", "m2", "habitaciones"] as const).filter(
    (c) => anuncio[c] === null || anuncio[c] === ""
  );

  // Si no hemos sacado ni el precio ni los metros, el anuncio se guarda
  // igual pero avisamos: lo rellenan a mano en quince segundos.
  if (anuncio.precio === null && anuncio.m2 === null) {
    return {
      ok: false,
      motivo: "Hemos abierto el anuncio pero no hemos podido leer los datos.",
      anuncio,
    };
  }

  return { ok: true, anuncio };
}
