import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { leerAnuncio } from "@/lib/barcelona/leerAnuncio";

/* ============================================================
   Puerta de entrada desde fuera de la app.

   La usan el Atajo del iPhone, el marcador del ordenador y la
   extensión. Se puede mandar de dos maneras:

     · Solo el enlace  → lo leemos aquí y lo guardamos.
     · La ficha entera → la guardamos tal cual.

   Protegido con un token compartido (BARCELONA_INGEST_TOKEN).
   Sin él no entra nada: este endpoint es público.
   ============================================================ */

export const maxDuration = 25;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface PisoEntrante {
  titulo: string;
  url?: string;
  portal?: string;
  portal_id?: string;
  precio?: number;
  gastos?: number;
  m2?: number;
  habitaciones?: number;
  banos?: number;
  planta?: string;
  ascensor?: boolean;
  amueblado?: boolean;
  exterior?: boolean;
  direccion?: string;
  barrio?: string;          // nombre; se resuelve contra bcn_barrios
  /** La página ya descargada por quien comparte el piso, si la manda. */
  html?: string;
  lat?: number;
  lng?: number;
  fotos?: string[];
  descripcion?: string;
  datos_extra?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const esperado = process.env.BARCELONA_INGEST_TOKEN;
  if (!esperado) {
    return NextResponse.json(
      { error: "Ingesta no configurada. Falta BARCELONA_INGEST_TOKEN." },
      { status: 503, headers: CORS }
    );
  }

  // El nombre del esquema no distingue mayúsculas (lo dice el estándar), y
  // los Atajos del iPhone lo escriben en minúscula. Comparamos solo el token.
  const auth = req.headers.get("authorization") ?? "";
  const recibido = auth.replace(/^bearer\s+/i, "").trim();
  if (!recibido || recibido !== esperado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: CORS });
  }

  try {
    let piso = (await req.json()) as PisoEntrante;
    let motivoLectura: string | null = null;

    // Si solo nos mandan el enlace —el Atajo del iPhone y el marcador
    // hacen eso—, lo leemos aquí y seguimos como si viniera entero.
    // Puede llegar con texto alrededor, tal cual sale de compartir.
    if (!piso?.titulo?.trim() && piso?.url) {
      const suelto = piso.url.match(/https?:\/\/[^\s"'<>]+/);
      const { anuncio, ...resto } = await leerAnuncio(
        suelto ? suelto[0] : piso.url,
        typeof piso.html === "string" ? piso.html : undefined
      );
      if (!resto.ok) motivoLectura = resto.motivo;
      piso = {
        ...piso,
        titulo: anuncio.titulo ?? anuncio.direccion ?? "Piso por revisar",
        url: anuncio.url,
        portal: anuncio.portal,
        portal_id: anuncio.portal_id ?? undefined,
        precio: anuncio.precio ?? undefined,
        m2: anuncio.m2 ?? undefined,
        habitaciones: anuncio.habitaciones ?? undefined,
        banos: anuncio.banos ?? undefined,
        planta: anuncio.planta ?? undefined,
        ascensor: anuncio.ascensor ?? undefined,
        amueblado: anuncio.amueblado ?? undefined,
        exterior: anuncio.exterior ?? undefined,
        direccion: anuncio.direccion ?? undefined,
        barrio: anuncio.barrio ?? undefined,
        fotos: anuncio.fotos,
        descripcion: anuncio.descripcion ?? undefined,
      };
    }

    if (!piso?.titulo?.trim()) {
      return NextResponse.json({ error: "Falta el título" }, { status: 400, headers: CORS });
    }

    // Etapa activa
    const { data: etapa } = await supabase
      .from("bcn_etapas")
      .select("id")
      .eq("activa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!etapa) {
      return NextResponse.json({ error: "No hay ninguna etapa activa" }, { status: 404, headers: CORS });
    }

    // Resolver el barrio por nombre. Los portales lo escriben a su manera
    // («La Prosperitat», «Vila de Gràcia», «Eixample Dreta»), así que no
    // basta con buscar la coincidencia exacta: se compara sin artículos y
    // aceptando que uno contenga al otro.
    let barrioId: string | null = null;
    if (piso.barrio) {
      const { data: barrios } = await supabase
        .from("bcn_barrios")
        .select("id, nombre")
        .eq("etapa_id", etapa.id);

      const normalizar = (t: string) =>
        t.toLowerCase()
          .normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/^(el|la|els|les|los|las)\s+/, "")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const buscado = normalizar(piso.barrio);
      const lista = (barrios ?? []) as { id: string; nombre: string }[];

      const encontrado =
        lista.find((b) => normalizar(b.nombre) === buscado) ??
        lista.find((b) => {
          const n = normalizar(b.nombre);
          return n.length > 3 && (buscado.includes(n) || n.includes(buscado));
        });

      barrioId = encontrado?.id ?? null;
    }

    // ¿Ya lo teníamos? Se identifica por portal + portal_id, o por url
    let existente: { id: string } | null = null;
    if (piso.portal && piso.portal_id) {
      const { data } = await supabase
        .from("bcn_pisos").select("id")
        .eq("etapa_id", etapa.id).eq("portal", piso.portal).eq("portal_id", piso.portal_id)
        .maybeSingle();
      existente = data;
    } else if (piso.url) {
      const { data } = await supabase
        .from("bcn_pisos").select("id")
        .eq("etapa_id", etapa.id).eq("url", piso.url)
        .maybeSingle();
      existente = data;
    }

    const campos = {
      titulo: piso.titulo.trim(),
      url: piso.url ?? null,
      portal: piso.portal ?? "extension",
      portal_id: piso.portal_id ?? null,
      precio: piso.precio ?? null,
      gastos: piso.gastos ?? null,
      m2: piso.m2 ?? null,
      habitaciones: piso.habitaciones ?? null,
      banos: piso.banos ?? null,
      planta: piso.planta ?? null,
      ascensor: piso.ascensor ?? null,
      amueblado: piso.amueblado ?? null,
      exterior: piso.exterior ?? null,
      direccion: piso.direccion ?? null,
      barrio_id: barrioId,
      lat: piso.lat ?? null,
      lng: piso.lng ?? null,
      fotos: piso.fotos ?? [],
      descripcion: piso.descripcion ?? null,
      datos_extra: piso.datos_extra ?? {},
      updated_at: new Date().toISOString(),
    };

    // Una frase corta para la notificación del móvil, que es lo único
    // que va a ver quien comparte el piso desde Idealista.
    const detalles = [
      piso.precio ? `${piso.precio.toLocaleString("es-ES")} €` : null,
      piso.m2 ? `${piso.m2} m²` : null,
      piso.habitaciones ? `${piso.habitaciones} hab` : null,
      piso.barrio ?? null,
    ].filter(Boolean);

    // Cuando quien comparte nos manda la página, iOS a veces la convierte a
    // texto y se lleva por delante las etiquetas: entonces llegan el precio y
    // los metros pero ni el título ni las fotos. Merece la pena decirlo.
    const fotosGuardadas = (piso.fotos ?? []).length;
    if (fotosGuardadas > 0) {
      detalles.push(`${fotosGuardadas} ${fotosGuardadas === 1 ? "foto" : "fotos"}`);
    } else if (typeof piso.html === "string" && !/<img|<meta/i.test(piso.html)) {
      detalles.push("sin fotos: llegó solo el texto");
    }

    const resumen = detalles.length
      ? detalles.join(" · ")
      : `Sin datos${motivoLectura ? `: ${motivoLectura}` : ""} Entra y complétalo.`;

    if (existente) {
      // No pisamos el estado: si ya lo habían descartado o marcado favorito, se respeta.
      const { error } = await supabase.from("bcn_pisos").update(campos).eq("id", existente.id);
      if (error) throw error;
      return NextResponse.json(
        { id: existente.id, creado: false, mensaje: `Ya lo teníais · ${resumen}` },
        { headers: CORS }
      );
    }

    const { data, error } = await supabase
      .from("bcn_pisos")
      .insert({ etapa_id: etapa.id, estado: "nuevo", ...campos })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json(
      { id: data.id, creado: true, mensaje: `Piso guardado · ${resumen}` },
      { headers: CORS }
    );
  } catch (error) {
    console.error("Barcelona ingesta error:", error);
    return NextResponse.json({ error: "Error guardando el piso" }, { status: 500, headers: CORS });
  }
}
