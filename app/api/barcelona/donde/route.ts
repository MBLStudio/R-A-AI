import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ============================================================
   ¿En qué barrio estamos?

   El móvil manda sus coordenadas y devolvemos el barrio, ya
   cruzado con los vuestros, y la calle. Para cuando estáis
   dando una vuelta y no sabéis dónde os habéis metido.

   Usa Nominatim (OpenStreetMap): gratis y sin claves. Su única
   condición es identificarse y no abusar, y aquí son dos
   personas apuntando momentos.
   ============================================================ */

export const maxDuration = 15;

/**
 * Cómo llama OpenStreetMap a sitios que vosotros llamáis de otra manera.
 * El Born es el caso claro: en el mapa oficial es «la Ribera».
 */
const ALIAS: [RegExp, string][] = [
  [/ribera|santa caterina|sant pere/i, "El Born"],
  [/g[òo]tic/i, "Gòtic"],
  [/esquerra de l.?eixample/i, "Eixample Esquerra"],
  [/dreta de l.?eixample|fort pienc|sagrada fam[íi]lia/i, "Eixample"],
  [/vila ol[íi]mpica/i, "Vila Olímpica"],
  [/poble.?sec|montju[íi]c/i, "Poble-sec"],
  [/hostafrancs/i, "Hostafrancs"],
  [/vila de gr[àa]cia|camp d.?en grassot/i, "Gràcia"],
  [/clot/i, "El Clot"],
  [/raval/i, "El Raval"],
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^(el|la|els|les|los|las|l')\s*/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas no válidas" }, { status: 400 });
  }

  let candidatos: string[] = [];
  let calle: string | null = null;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&zoom=18&addressdetails=1&accept-language=ca,es`;

    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 9_000);
    const res = await fetch(url, {
      headers: { "User-Agent": "R&A-Barcelona/1.0 (uso personal, dos personas)" },
      signal: corte.signal,
    });
    clearTimeout(reloj);

    if (!res.ok) throw new Error(String(res.status));
    const datos = (await res.json()) as { address?: Record<string, string> };
    const dir = datos.address ?? {};

    candidatos = [dir.neighbourhood, dir.quarter, dir.suburb, dir.city_district, dir.borough]
      .filter(Boolean) as string[];
    calle = dir.road ?? null;
  } catch {
    return NextResponse.json(
      { error: "No hemos podido averiguar dónde estáis. Poned el barrio a mano." },
      { status: 502 }
    );
  }

  if (candidatos.length === 0) {
    return NextResponse.json({ barrio: null, barrio_id: null, calle, sugerido: null });
  }

  // Los vuestros, para cruzarlos
  const { data: etapa } = await supabase
    .from("bcn_etapas").select("id").eq("activa", true)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  let barrioId: string | null = null;
  let barrioNombre: string | null = null;

  if (etapa) {
    const { data } = await supabase
      .from("bcn_barrios").select("id, nombre").eq("etapa_id", etapa.id);
    const vuestros = (data ?? []) as { id: string; nombre: string }[];

    // 1. Tal cual lo dice el mapa
    for (const c of candidatos) {
      const encontrado = vuestros.find((b) => normalizar(b.nombre) === normalizar(c));
      if (encontrado) { barrioId = encontrado.id; barrioNombre = encontrado.nombre; break; }
    }

    // 2. Traduciendo el nombre oficial al que usáis vosotros
    if (!barrioId) {
      for (const c of candidatos) {
        const alias = ALIAS.find(([patron]) => patron.test(c))?.[1];
        if (!alias) continue;
        const encontrado = vuestros.find((b) => normalizar(b.nombre) === normalizar(alias));
        if (encontrado) { barrioId = encontrado.id; barrioNombre = encontrado.nombre; break; }
      }
    }

    // 3. Que uno contenga al otro («Sants» dentro de «Sants-Montjuïc»)
    if (!barrioId) {
      for (const c of candidatos) {
        const n = normalizar(c);
        const encontrado = vuestros.find((b) => {
          const m = normalizar(b.nombre);
          return m.length > 3 && (n.includes(m) || m.includes(n));
        });
        if (encontrado) { barrioId = encontrado.id; barrioNombre = encontrado.nombre; break; }
      }
    }
  }

  return NextResponse.json({
    barrio_id: barrioId,
    barrio: barrioNombre,
    // Cómo lo llama el mapa, por si no es ninguno de los vuestros
    sugerido: candidatos[0] ?? null,
    calle,
  });
}
