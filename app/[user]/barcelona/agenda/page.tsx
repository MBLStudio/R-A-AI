"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, type Momento, type Etapa, type Barrio } from "@/lib/barcelona/types";
import {
  getEtapaActiva, getMomentos, getBarrios, hoyISO, formatFechaLarga, nombreDia,
} from "@/lib/barcelona/queries";
import { Pantalla, IconoMas } from "@/components/barcelona/Shell";
import { HojaEvento } from "@/components/barcelona/HojaEvento";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

/** Fecha ISO local, sin líos de zona horaria. */
function iso(a: number, m: number, d: number): string {
  return `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarioPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const hoy = hoyISO();
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(hoy);
  const [abierto, setAbierto] = useState<Momento | null>(null);

  const [ancla, setAncla] = useState(() => {
    const d = new Date(hoy + "T12:00:00");
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);
    const [m, b] = await Promise.all([getMomentos(e.id), getBarrios(e.id)]);
    setMomentos(m);
    setBarrios(b);
    // Si hay una ficha abierta, refrescarla con los datos nuevos.
    setAbierto((prev) => (prev ? m.find((x) => x.id === prev.id) ?? null : null));
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /** Momentos agrupados por fecha, para pintar los puntos. */
  const porFecha = useMemo(() => {
    const m = new Map<string, Momento[]>();
    for (const x of momentos) {
      const lista = m.get(x.fecha);
      if (lista) lista.push(x);
      else m.set(x.fecha, [x]);
    }
    for (const lista of m.values()) {
      lista.sort((a, b) => (a.hora ?? "99").localeCompare(b.hora ?? "99"));
    }
    return m;
  }, [momentos]);

  /** Celdas del mes: huecos al principio + los días. */
  const celdas = useMemo(() => {
    const primero = new Date(ancla.anio, ancla.mes, 1);
    const huecos = (primero.getDay() + 6) % 7;              // lunes = 0
    const total = new Date(ancla.anio, ancla.mes + 1, 0).getDate();
    return [
      ...Array<null>(huecos).fill(null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
  }, [ancla]);

  const delDia = porFecha.get(seleccionado) ?? [];

  const mover = (n: number) => {
    setAncla((a) => {
      const d = new Date(a.anio, a.mes + n, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  };

  return (
    <Pantalla
      titulo="Calendario"
      subtitulo={etapa?.nombre ?? "Vuestros días"}
      color={BCN.mar}
      accion={{
        icon: IconoMas,
        label: "Añadir",
        onClick: () => router.push(`/${user}/barcelona/momento?fecha=${seleccionado}&plan=1`),
      }}
    >
      {cargando ? (
        <div style={{ height: 320, borderRadius: 18, background: BCN.arenaOsc, opacity: 0.5 }} />
      ) : (
        <>
          {/* ── Rejilla del mes ── */}
          <div style={{ background: "white", borderRadius: 18, border: `1px solid ${BCN.arenaOsc}`, padding: "14px 12px 12px", boxShadow: "0 2px 10px rgba(44,36,32,0.04)" }}>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 14, padding: "0 4px" }}>
              <button onClick={() => mover(-1)} aria-label="Mes anterior" style={flecha}>‹</button>
              <p style={{ flex: 1, textAlign: "center", fontFamily: "Georgia, serif", fontSize: 17, color: BCN.tinta, margin: 0, textTransform: "capitalize" }}>
                {MESES[ancla.mes]} {ancla.anio}
              </p>
              <button onClick={() => mover(1)} aria-label="Mes siguiente" style={flecha}>›</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {DIAS_SEMANA.map((d, i) => (
                <p key={i} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: BCN.humo, margin: "0 0 4px" }}>
                  {d}
                </p>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`h${i}`} />;

                const fecha = iso(ancla.anio, ancla.mes, dia);
                const items = porFecha.get(fecha) ?? [];
                const esHoy = fecha === hoy;
                const activo = fecha === seleccionado;

                return (
                  <button key={fecha} onClick={() => setSeleccionado(fecha)}
                    style={{
                      aspectRatio: "1", border: "none", cursor: "pointer", borderRadius: 11,
                      background: activo ? BCN.mar : esHoy ? `${BCN.mar}14` : "transparent",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 3, padding: 0, transition: "background 0.15s",
                    }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: activo || esHoy ? 700 : 400,
                      color: activo ? "white" : esHoy ? BCN.mar : BCN.tinta,
                    }}>
                      {dia}
                    </span>

                    <div style={{ display: "flex", gap: 2, height: 4 }}>
                      {items.slice(0, 3).map((m) => (
                        <span key={m.id} style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: activo ? "rgba(255,255,255,0.9)" : (TIPO_MOMENTO[m.tipo]?.color ?? BCN.humo),
                          opacity: m.estado === "vivido" ? 1 : 0.55,
                        }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── El día elegido ── */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 11, padding: "0 3px" }}>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: 0, textTransform: "capitalize" }}>
                {seleccionado === hoy ? "Hoy" : nombreDia(seleccionado)}
              </p>
              <p style={{ fontSize: 12.5, color: BCN.humo, margin: 0 }}>
                {formatFechaLarga(seleccionado)}
              </p>
              {delDia.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 11.5, color: BCN.humo }}>
                  {delDia.length} {delDia.length === 1 ? "cosa" : "cosas"}
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={seleccionado}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {delDia.length === 0 ? (
                  <button onClick={() => router.push(`/${user}/barcelona/momento?fecha=${seleccionado}&plan=1`)}
                    style={{
                      width: "100%", padding: "26px 20px", borderRadius: 16,
                      border: `1.5px dashed ${BCN.arenaOsc}`, background: "transparent",
                      cursor: "pointer", textAlign: "center",
                    }}>
                    <p style={{ fontSize: 14, color: BCN.humo, margin: 0 }}>
                      Nada este día. <strong style={{ color: BCN.mar }}>Añadir algo</strong>
                    </p>
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {delDia.map((m, i) => (
                      <Evento key={m.id} momento={m} delay={i * 0.04} onAbrir={() => setAbierto(m)} />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      <HojaEvento
        momento={abierto}
        barrios={barrios}
        onCerrar={() => setAbierto(null)}
        onCambio={cargar}
      />
    </Pantalla>
  );
}

/* ─── Un evento del día ────────────────────────────────────── */

function Evento({ momento, delay, onAbrir }: {
  momento: Momento; delay: number; onAbrir: () => void;
}) {
  const cfg = TIPO_MOMENTO[momento.tipo] ?? TIPO_MOMENTO.otro;
  const vivido = momento.estado === "vivido";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.25 }}
      whileTap={{ scale: 0.985 }}
      style={{
        background: "white", borderRadius: 15,
        border: `1px solid ${vivido ? cfg.color + "33" : BCN.arenaOsc}`,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(44,36,32,0.04)",
      }}
    >
      <button onClick={onAbrir}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "13px 15px", display: "flex", alignItems: "flex-start", gap: 12 }}>

        <div style={{ width: 38, height: 38, borderRadius: 11, background: `${cfg.color}16`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
          {cfg.icon}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {momento.hora && (
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{momento.hora.slice(0, 5)}</span>
            )}
            {vivido && <span style={{ fontSize: 10 }}>✓</span>}
            {momento.es_hito && <span style={{ fontSize: 10 }}>⭐</span>}
            {momento.autor !== "ambos" && (
              <span style={{ fontSize: 10, color: BCN.humo, background: BCN.arena, padding: "1px 6px", borderRadius: 5 }}>
                {momento.autor === "rut" ? "Rut" : "Alejandro"}
              </span>
            )}
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: BCN.tinta, margin: "2px 0 0", lineHeight: 1.3 }}>
            {momento.titulo}
          </p>
          {momento.lugar && (
            <p style={{ fontSize: 12, color: BCN.humo, margin: "2px 0 0" }}>📍 {momento.lugar}</p>
          )}
          {momento.nota && (
            <p style={{
              fontSize: 13.5, color: BCN.tinta, opacity: 0.8, margin: "6px 0 0", lineHeight: 1.5,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {momento.nota}
            </p>
          )}
        </div>

        <span style={{ color: BCN.arenaOsc, fontSize: 17, alignSelf: "center", flexShrink: 0 }}>›</span>
      </button>
    </motion.div>
  );
}


const flecha: React.CSSProperties = {
  width: 30, height: 30, borderRadius: "50%", border: "none", background: BCN.arena,
  color: BCN.tinta, fontSize: 19, cursor: "pointer", lineHeight: 1, flexShrink: 0,
};
