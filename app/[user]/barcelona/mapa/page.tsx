"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, pintarMomento, type Barrio, type Momento, type Piso, type Valoracion } from "@/lib/barcelona/types";
import { rankear, colorCompat } from "@/lib/barcelona/compat";
import { getEtapaActiva, getBarrios, getHistoria, getPisos, getValoraciones, formatFechaLarga } from "@/lib/barcelona/queries";
import { Pantalla, Vacio } from "@/components/barcelona/Shell";

type Capa = "barrios" | "pisos" | "recuerdos" | "lugares";

const CAPAS: { id: Capa; label: string; icon: string; color: string }[] = [
  { id: "barrios",   label: "Barrios",   icon: "🌆", color: BCN.sol },
  { id: "pisos",     label: "Pisos",     icon: "🏠", color: BCN.tejaOsc },
  { id: "recuerdos", label: "Recuerdos", icon: "📸", color: BCN.teja },
  { id: "lugares",   label: "Lugares",   icon: "🍽️", color: BCN.oliva },
];

interface Punto {
  id: string; lat: number; lng: number; icon: string; color: string;
  titulo: string; detalle: string; capa: Capa;
}

/* Leaflet toca `window` al importarse: fuera del render de servidor. */
const MapaReal = dynamic(() => import("@/components/barcelona/MapaReal"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BCN.arena }}>
      <p style={{ fontSize: 13, color: BCN.humo, fontStyle: "italic" }}>Cargando el mapa…</p>
    </div>
  ),
});

export default function MapaPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [valoraciones, setValoraciones] = useState<Valoracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [activas, setActivas] = useState<Capa[]>(["barrios", "recuerdos", "pisos", "lugares"]);
  const [seleccion, setSeleccion] = useState<Punto | null>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    const [b, m, p, v] = await Promise.all([
      getBarrios(e.id), getHistoria(e.id), getPisos(e.id), getValoraciones(e.id, "barrio"),
    ]);
    setBarrios(b); setMomentos(m); setPisos(p); setValoraciones(v);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const ranking = useMemo(() => rankear(barrios, valoraciones), [barrios, valoraciones]);
  const compatDe = (id: string) => ranking.find((r) => r.entidad.id === id)?.compat.porcentaje ?? null;

  /** Puntos que no son barrios. Si no tienen coordenadas, se anclan a su barrio. */
  const puntos = useMemo<Punto[]>(() => {
    // Espiral de Fermat: reparte los puntos anclados a un barrio sin que se apilen
    const anclar = (barrioId: string | null, i: number) => {
      const b = barrios.find((x) => x.id === barrioId);
      if (!b?.lat || !b?.lng) return null;
      const angulo = (i * 137.5 * Math.PI) / 180;
      const radio = 0.0022;
      return { lat: b.lat + Math.sin(angulo) * radio, lng: b.lng + Math.cos(angulo) * radio };
    };

    const lista: Punto[] = [];

    pisos.forEach((p, i) => {
      const c = p.lat && p.lng ? { lat: p.lat, lng: p.lng } : anclar(p.barrio_id, i);
      if (!c) return;
      lista.push({
        id: `piso-${p.id}`, ...c, icon: "🏠", color: BCN.tejaOsc, capa: "pisos",
        titulo: p.titulo,
        detalle: [p.precio ? `${p.precio}€/mes` : null, p.m2 ? `${p.m2} m²` : null, p.estado].filter(Boolean).join(" · "),
      });
    });

    momentos.forEach((m, i) => {
      const esLugar = ["restaurante", "rooftop", "playa", "excursion"].includes(m.tipo);
      const capa: Capa = esLugar ? "lugares" : "recuerdos";
      const c = m.lat && m.lng ? { lat: m.lat, lng: m.lng } : anclar(m.barrio_id, i + 3);
      if (!c) return;
      const cfg = pintarMomento(m.tipo, m.titulo);
      lista.push({
        id: `mom-${m.id}`, ...c, icon: cfg.icon, color: cfg.color, capa,
        titulo: m.titulo,
        detalle: `${formatFechaLarga(m.fecha)}${m.lugar ? ` · ${m.lugar}` : ""}`,
      });
    });

    return lista;
  }, [barrios, momentos, pisos]);

  const visibles = puntos.filter((p) => activas.includes(p.capa));
  const conCoordenadas = barrios.filter((b) => b.lat && b.lng);

  const alternar = (c: Capa) =>
    setActivas((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Pantalla titulo="Mapa" subtitulo="Vuestra Barcelona sobre el plano" color={BCN.marClaro}>
      {cargando ? (
        <div style={{ height: 380, borderRadius: 20, background: BCN.arenaOsc, opacity: 0.6 }} />
      ) : conCoordenadas.length === 0 ? (
        <Vacio icon="🗺️" titulo="Sin mapa" texto="Ejecuta el SQL de Barcelona para cargar los barrios con sus coordenadas." />
      ) : (
        <>
          {/* Capas */}
          <div style={{ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto", paddingBottom: 3 }}>
            {CAPAS.map((c) => {
              const on = activas.includes(c.id);
              return (
                <button key={c.id} onClick={() => alternar(c.id)}
                  style={{
                    flexShrink: 0, padding: "8px 13px", borderRadius: 18, cursor: "pointer",
                    border: `1px solid ${on ? c.color : BCN.arenaOsc}`,
                    background: on ? c.color : "white",
                    color: on ? "white" : BCN.humo,
                    fontSize: 12.5, fontWeight: on ? 700 : 500, transition: "all 0.15s",
                  }}>
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>

          {/* Lienzo */}
          <div style={{
            position: "relative", borderRadius: 22, overflow: "hidden",
            border: `1px solid ${BCN.arenaOsc}`, aspectRatio: "1 / 1",
            boxShadow: "0 6px 24px rgba(44,36,32,0.08)",
          }}>
            <MapaReal
                mostrarBarrios={activas.includes("barrios")}
                barrios={conCoordenadas.map((b) => ({
                  id: b.id, nombre: b.nombre, lat: b.lat!, lng: b.lng!,
                  color: b.color ?? BCN.teja,
                  compatibilidad: compatDe(b.id),
                  descripcion: b.descripcion,
                }))}
                puntos={visibles.map((p) => ({
                  id: p.id, lat: p.lat, lng: p.lng,
                  icon: p.icon, color: p.color, titulo: p.titulo, detalle: p.detalle,
                }))}
              />
          </div>

          {/* Detalle */}
          <AnimatePresence mode="wait">
            {seleccion && (
              <motion.div
                key={seleccion.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                style={{
                  marginTop: 14, background: "white", border: `1px solid ${BCN.arenaOsc}`,
                  borderRadius: 16, padding: "14px 16px", borderLeft: `4px solid ${seleccion.color}`,
                }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                  <span style={{ fontSize: 21 }}>{seleccion.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 17, color: BCN.tinta, margin: 0 }}>
                      {seleccion.titulo}
                    </p>
                    <p style={{ fontSize: 13, color: BCN.humo, margin: "3px 0 0", lineHeight: 1.5 }}>
                      {seleccion.detalle}
                    </p>
                  </div>
                  <button onClick={() => setSeleccion(null)} aria-label="Cerrar"
                    style={{ background: "none", border: "none", color: BCN.humo, fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p style={{ fontSize: 12.5, color: BCN.humo, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
            {visibles.length > 0
              ? `${visibles.length} ${visibles.length === 1 ? "punto" : "puntos"} sobre el mapa. Pulsad cualquiera.`
              : "Aún no hay nada que colocar. Guardad momentos o pisos y aparecerán aquí."}
          </p>
        </>
      )}
    </Pantalla>
  );
}
