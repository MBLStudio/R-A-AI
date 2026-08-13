import { NextRequest, NextResponse } from "next/server";

/* ============================================================
   ¿Dónde cae este sitio?

   Se le da un nombre —un barrio, un pueblo, una zona— y
   devuelve sus coordenadas, para que aparezca en el mapa.

   Al revés que /api/barcelona/donde, que va de coordenadas a
   nombre. Usa el mismo servicio de OpenStreetMap.
   ============================================================ */

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const consulta = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (consulta.length < 2) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }

  try {
    // Se busca dentro de Cataluña: hay muchos sitios que se llaman igual
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&q=${encodeURIComponent(consulta + ", Catalunya")}` +
      `&limit=1&addressdetails=1&accept-language=ca,es`;

    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 9_000);
    const res = await fetch(url, {
      headers: { "User-Agent": "R&A-Barcelona/1.0 (uso personal, dos personas)" },
      signal: corte.signal,
    });
    clearTimeout(reloj);

    if (!res.ok) throw new Error(String(res.status));
    const encontrados = (await res.json()) as {
      lat: string;
      lon: string;
      name?: string;
      address?: Record<string, string>;
    }[];

    if (!encontrados.length) {
      return NextResponse.json({ lat: null, lng: null });
    }

    const s = encontrados[0];
    const dir = s.address ?? {};

    return NextResponse.json({
      lat: Number(s.lat),
      lng: Number(s.lon),
      nombre: s.name ?? null,
      // La comarca o la provincia, para saber por dónde cae
      zona: dir.county ?? dir.state_district ?? dir.province ?? dir.state ?? null,
    });
  } catch {
    return NextResponse.json(
      { lat: null, lng: null, error: "No hemos podido buscarlo." },
      { status: 502 }
    );
  }
}
