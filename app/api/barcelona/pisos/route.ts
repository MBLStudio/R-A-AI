import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ============================================================
   Puerta de entrada para la extensión de Chrome.

   Idealista / Fotocasa → extensión → aquí → ficha viva en R&A.

   Protegido con un token compartido (BARCELONA_INGEST_TOKEN).
   Sin él no entra nada: este endpoint es público.
   ============================================================ */

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

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${esperado}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401, headers: CORS });
  }

  try {
    const piso = (await req.json()) as PisoEntrante;

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

    // Resolver el barrio por nombre, si viene
    let barrioId: string | null = null;
    if (piso.barrio) {
      const { data: b } = await supabase
        .from("bcn_barrios")
        .select("id")
        .eq("etapa_id", etapa.id)
        .ilike("nombre", piso.barrio.trim())
        .maybeSingle();
      barrioId = b?.id ?? null;
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

    if (existente) {
      // No pisamos el estado: si ya lo habían descartado o marcado favorito, se respeta.
      const { error } = await supabase.from("bcn_pisos").update(campos).eq("id", existente.id);
      if (error) throw error;
      return NextResponse.json({ id: existente.id, creado: false }, { headers: CORS });
    }

    const { data, error } = await supabase
      .from("bcn_pisos")
      .insert({ etapa_id: etapa.id, estado: "nuevo", ...campos })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, creado: true }, { headers: CORS });
  } catch (error) {
    console.error("Barcelona ingesta error:", error);
    return NextResponse.json({ error: "Error guardando el piso" }, { status: 500, headers: CORS });
  }
}
