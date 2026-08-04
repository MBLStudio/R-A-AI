"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN } from "@/lib/barcelona/types";
import type { Etapa, Barrio, Momento, Piso, Valoracion, Contacto } from "@/lib/barcelona/types";
import { rankear } from "@/lib/barcelona/compat";
import {
  getEtapaActiva, getSnapshot, diasEnCiudad, formatFechaCorta, nombreDia, hoyISO,
} from "@/lib/barcelona/queries";

/* ═══════════════════════════════════════════════════════════
   Proyecto Barcelona — Catalanes por una temporada
   No es un módulo. Es un capítulo de vuestra historia.
   ═══════════════════════════════════════════════════════════ */

interface Bloque {
  id: string;
  titulo: string;
  sub: string;
  icon: string;
  color: string;
  ancho: 1 | 2;
}

const BLOQUES: Bloque[] = [
  { id: "historia",          titulo: "Nuestra historia",  sub: "La línea del tiempo",       icon: "📖", color: BCN.teja,     ancho: 2 },
  { id: "agenda",            titulo: "Agenda",            sub: "Lo que viene",              icon: "🗓️", color: BCN.mar,      ancho: 1 },
  { id: "barrios",           titulo: "Barrios",           sub: "Posibilidades de vida",     icon: "🌆", color: BCN.sol,      ancho: 1 },
  { id: "vivienda",          titulo: "Vivienda",          sub: "Cada piso, una decisión",   icon: "🏠", color: BCN.tejaOsc,  ancho: 1 },
  { id: "experiencias",      titulo: "Experiencias",      sub: "Lo que os marcó",           icon: "🍽️", color: BCN.oliva,    ancho: 1 },
  { id: "mapa",              titulo: "Mapa emocional",    sub: "Vuestra Barcelona sobre el plano", icon: "🗺️", color: BCN.marClaro, ancho: 2 },
  { id: "contactos",         titulo: "Contactos",         sub: "Quién os ayudó",            icon: "📇", color: BCN.humo,     ancho: 1 },
  { id: "copiloto",          titulo: "Copiloto",          sub: "Preguntadme lo que sea",    icon: "✨", color: BCN.noche,    ancho: 1 },
];

export default function BarcelonaPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [valoraciones, setValoraciones] = useState<Valoracion[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinEtapa, setSinEtapa] = useState(false);

  const [resumen, setResumen] = useState<string | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(true);

  useEffect(() => {
    if (user && user !== activeUser) setUser(user, user);
  }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setSinEtapa(true); setCargando(false); setCargandoResumen(false); return; }
    const snap = await getSnapshot(e);
    setEtapa(snap.etapa);
    setBarrios(snap.barrios);
    setMomentos(snap.momentos);
    setPisos(snap.pisos);
    setValoraciones(snap.valoraciones);
    setContactos(snap.contactos);
    setCargando(false);

    try {
      const res = await fetch("/api/barcelona/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapaId: e.id, tipo: "hub" }),
      });
      const data = await res.json();
      setResumen(data.contenido ?? null);
    } catch { setResumen(null); }
    setCargandoResumen(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const dias = etapa ? diasEnCiudad(etapa.fecha_llegada) : null;
  const hoy = hoyISO();
  const vividos = momentos.filter((m) => m.estado === "vivido");
  const proximos = momentos
    .filter((m) => m.estado === "previsto" && m.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const rankingBarrios = rankear(barrios, valoraciones.filter((v) => v.entidad_tipo === "barrio"));
  const mejorBarrio = rankingBarrios.find((r) => r.compat.porcentaje !== null);

  const ir = (id: string) => router.push(`/${user}/barcelona/${id}`);

  return (
    <div style={{ minHeight: "100dvh", background: BCN.arena, position: "relative" }}>

      {/* ══ Cabecera ══ */}
      <Cabecera
        etapa={etapa}
        dias={dias}
        onBack={() => router.push(`/${user}`)}
        onAjustes={() => ir("ajustes")}
      />

      <div style={{ padding: "0 16px", paddingBottom: 140, maxWidth: 680, margin: "0 auto" }}>

        {sinEtapa ? (
          <SinEtapa />
        ) : (
          <>
            {/* ══ Resumen IA ══ */}
            <ResumenIA texto={resumen} cargando={cargandoResumen} />

            {/* ══ Pulso ══ */}
            {!cargando && (
              <Pulso
                momentos={vividos.length}
                barrios={rankingBarrios.filter((r) => r.compat.porcentaje !== null).length}
                pisos={pisos.length}
                contactos={contactos.length}
              />
            )}

            {/* ══ Lo próximo ══ */}
            {proximos.length > 0 && <Proximo momento={proximos[0]} onClick={() => ir("agenda")} />}

            {/* ══ El barrio que gana ══ */}
            {mejorBarrio && (
              <BarrioLider
                nombre={mejorBarrio.entidad.nombre}
                porcentaje={mejorBarrio.compat.porcentaje!}
                estado={mejorBarrio.compat.estado}
                color={mejorBarrio.entidad.color ?? BCN.teja}
                onClick={() => ir("barrios")}
              />
            )}

            {/* ══ Mosaico de bloques ══ */}
            <p style={etiqueta}>El proyecto</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {BLOQUES.map((b, i) => (
                <BloqueCard key={b.id} bloque={b} delay={0.04 * i} onClick={() => ir(b.id)} />
              ))}
            </div>

            {/* ══ Nuestra Barcelona ══ */}
            <NuestraBarcelona onClick={() => ir("nuestra-barcelona")} />
          </>
        )}
      </div>

      {/* ══ Guardar momento ══ */}
      {!sinEtapa && <BotonMomento onClick={() => ir("momento")} />}
    </div>
  );
}

/* ─── Cabecera ─────────────────────────────────────────────── */

function Cabecera({ etapa, dias, onBack, onAjustes }: {
  etapa: Etapa | null; dias: number | null; onBack: () => void; onAjustes: () => void;
}) {
  const titulo = etapa?.subtitulo ?? "Catalanes por una temporada";

  return (
    <div style={{ position: "relative", overflow: "hidden", marginBottom: 18 }}>
      {/* Degradado del atardecer sobre Montjuïc */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(160deg, ${BCN.tejaOsc} 0%, ${BCN.teja} 45%, ${BCN.sol} 100%)`,
      }} />
      {/* Textura de trencadís */}
      <Trencadis />

      <div style={{
        position: "relative",
        padding: "16px 20px 30px",
        paddingTop: `calc(16px + env(safe-area-inset-top))`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <button onClick={onBack} aria-label="Volver"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Proyecto Barcelona
          </span>
          <button onClick={onAjustes} aria-label="Ajustes"
            style={{ marginLeft: "auto", width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" />
              <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 400, color: "white", margin: 0, lineHeight: 1.12, letterSpacing: "-0.5px", textShadow: "0 2px 12px rgba(0,0,0,0.18)" }}
        >
          {titulo}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
          style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 9 }}
        >
          {dias === null ? null : dias < 0 ? (
            <>
              <span style={numeroGrande}>{Math.abs(dias)}</span>
              <span style={numeroTexto}>{Math.abs(dias) === 1 ? "día para llegar" : "días para llegar"}</span>
            </>
          ) : dias === 0 ? (
            <span style={{ ...numeroTexto, fontSize: 17 }}>Hoy empieza todo</span>
          ) : (
            <>
              <span style={numeroGrande}>{dias}</span>
              <span style={numeroTexto}>{dias === 1 ? "día aquí" : "días aquí"}</span>
            </>
          )}
        </motion.div>
      </div>

      {/* Borde inferior ondulado, como el mar */}
      <svg viewBox="0 0 400 22" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 22, position: "relative", marginTop: -1 }}>
        <path d="M0,14 C50,4 100,20 150,12 C200,4 250,18 300,11 C350,4 380,14 400,10 L400,22 L0,22 Z" fill={BCN.arena} />
      </svg>
    </div>
  );
}

/** Textura de mosaico: el trencadís de Gaudí, en SVG y sin dependencias. */
function Trencadis() {
  const piezas = [
    { x: 8,  y: 12, w: 26, h: 20, r: -12, o: 0.10 },
    { x: 44, y: 30, w: 34, h: 16, r: 8,   o: 0.07 },
    { x: 78, y: 8,  w: 20, h: 26, r: 22,  o: 0.09 },
    { x: 20, y: 52, w: 30, h: 22, r: 16,  o: 0.06 },
    { x: 62, y: 62, w: 24, h: 18, r: -18, o: 0.08 },
    { x: 88, y: 44, w: 18, h: 22, r: 6,   o: 0.05 },
    { x: 2,  y: 78, w: 22, h: 16, r: 28,  o: 0.07 },
    { x: 50, y: 84, w: 28, h: 14, r: -8,  o: 0.05 },
  ];
  return (
    <svg viewBox="0 0 110 100" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
      {piezas.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={3}
          fill="white" opacity={p.o} transform={`rotate(${p.r} ${p.x + p.w / 2} ${p.y + p.h / 2})`} />
      ))}
    </svg>
  );
}

/* ─── Resumen IA ───────────────────────────────────────────── */

function ResumenIA({ texto, cargando }: { texto: string | null; cargando: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
      style={{
        background: "white", borderRadius: 20, padding: "20px 22px", marginBottom: 14,
        border: `1px solid ${BCN.arenaOsc}`,
        boxShadow: "0 6px 26px rgba(44,36,32,0.07)",
        borderLeft: `4px solid ${BCN.teja}`,
      }}
    >
      <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.teja, textTransform: "uppercase", letterSpacing: "0.13em", margin: "0 0 12px" }}>
        Cómo vamos
      </p>

      {cargando ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {[100, 88, 72].map((w, i) => (
            <motion.div key={i}
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
              style={{ height: 12, width: `${w}%`, borderRadius: 6, background: BCN.arenaOsc }} />
          ))}
        </div>
      ) : texto ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {texto.split("\n").filter((l) => l.trim()).map((linea, i) => {
            const esRecomendacion = /^recomendaci[óo]n:/i.test(linea.trim());
            return (
              <p key={i} style={{
                fontSize: 15, lineHeight: 1.55, margin: 0,
                color: esRecomendacion ? BCN.teja : BCN.tinta,
                fontWeight: esRecomendacion ? 600 : 400,
              }}>
                {linea.trim()}
              </p>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 14.5, color: BCN.humo, margin: 0, lineHeight: 1.55 }}>
          Aquí aparecerá vuestro resumen en cuanto haya algo que contar.
        </p>
      )}
    </motion.div>
  );
}

/* ─── Pulso ────────────────────────────────────────────────── */

function Pulso({ momentos, barrios, pisos, contactos }: {
  momentos: number; barrios: number; pisos: number; contactos: number;
}) {
  const datos = [
    { n: momentos, label: momentos === 1 ? "momento" : "momentos" },
    { n: barrios,  label: barrios === 1 ? "barrio" : "barrios" },
    { n: pisos,    label: pisos === 1 ? "piso" : "pisos" },
    { n: contactos, label: contactos === 1 ? "contacto" : "contactos" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
      style={{ display: "flex", gap: 8, marginBottom: 14 }}
    >
      {datos.map((d) => (
        <div key={d.label} style={{
          flex: 1, background: "rgba(255,255,255,0.7)", borderRadius: 14,
          border: `1px solid ${BCN.arenaOsc}`, padding: "11px 6px", textAlign: "center",
        }}>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 400, color: d.n > 0 ? BCN.teja : BCN.humo, margin: 0, lineHeight: 1 }}>
            {d.n}
          </p>
          <p style={{ fontSize: 9.5, color: BCN.humo, margin: "4px 0 0", letterSpacing: "0.03em" }}>{d.label}</p>
        </div>
      ))}
    </motion.div>
  );
}

/* ─── Lo próximo ───────────────────────────────────────────── */

function Proximo({ momento, onClick }: { momento: Momento; onClick: () => void }) {
  const hoy = hoyISO();
  const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const cuando =
    momento.fecha === hoy ? "Hoy" :
    momento.fecha === manana ? "Mañana" :
    `${nombreDia(momento.fecha)} ${formatFechaCorta(momento.fecha)}`;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{
        width: "100%", marginBottom: 14, border: "none", cursor: "pointer", textAlign: "left",
        borderRadius: 18, padding: "15px 18px",
        background: `linear-gradient(135deg, ${BCN.mar} 0%, ${BCN.marClaro} 100%)`,
        display: "flex", alignItems: "center", gap: 14,
        boxShadow: `0 5px 20px ${BCN.mar}33`,
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>
        {momento.tipo === "visita_piso" ? "🏠" : momento.tipo === "cita" ? "📌" : "🗓️"}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
          {cuando}{momento.hora ? ` · ${momento.hora.slice(0, 5)}` : ""}
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "white", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {momento.titulo}
        </p>
      </div>
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.6)", fontSize: 20 }}>›</span>
    </motion.button>
  );
}

/* ─── Barrio líder ─────────────────────────────────────────── */

function BarrioLider({ nombre, porcentaje, estado, color, onClick }: {
  nombre: string; porcentaje: number; estado: string; color: string; onClick: () => void;
}) {
  const lectura =
    estado === "consenso" ? "Coincidís" :
    estado === "matiz" ? "Casi de acuerdo" : "Lo veis distinto";

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{
        width: "100%", marginBottom: 22, border: `1px solid ${BCN.arenaOsc}`, cursor: "pointer",
        textAlign: "left", borderRadius: 18, padding: "16px 18px", background: "white",
        display: "flex", alignItems: "center", gap: 16,
        boxShadow: "0 3px 14px rgba(44,36,32,0.05)",
      }}
    >
      <Anillo porcentaje={porcentaje} color={color} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.11em", margin: 0 }}>
          Vuestro barrio
        </p>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 20, color: BCN.tinta, margin: "2px 0 0" }}>{nombre}</p>
        <p style={{ fontSize: 12.5, color: BCN.humo, margin: "2px 0 0" }}>{lectura}</p>
      </div>
      <span style={{ marginLeft: "auto", color: BCN.humo, fontSize: 20 }}>›</span>
    </motion.button>
  );
}

/** Anillo de compatibilidad. */
function Anillo({ porcentaje, color, size = 58 }: { porcentaje: number; color: string; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BCN.arenaOsc} strokeWidth={4} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * porcentaje) / 100 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.35 }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: size * 0.3, color: BCN.tinta }}>{porcentaje}</span>
      </div>
    </div>
  );
}

/* ─── Mosaico ──────────────────────────────────────────────── */

function BloqueCard({ bloque, delay, onClick }: { bloque: Bloque; delay: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay }}
      whileTap={{ scale: 0.95 }} onClick={onClick}
      style={{
        gridColumn: bloque.ancho === 2 ? "span 2" : "span 1",
        background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 18,
        padding: "16px 16px 15px", cursor: "pointer", textAlign: "left",
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: bloque.ancho === 2 ? 92 : 106,
        boxShadow: "0 2px 10px rgba(44,36,32,0.04)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Marca de color a la izquierda */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: bloque.color }} />
      <span style={{ fontSize: 24, lineHeight: 1 }}>{bloque.icon}</span>
      <div>
        <p style={{ fontSize: 14.5, fontWeight: 700, color: BCN.tinta, margin: 0, lineHeight: 1.25 }}>{bloque.titulo}</p>
        <p style={{ fontSize: 11.5, color: BCN.humo, margin: "3px 0 0", lineHeight: 1.35 }}>{bloque.sub}</p>
      </div>
    </motion.button>
  );
}

/* ─── Nuestra Barcelona ────────────────────────────────────── */

function NuestraBarcelona({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{
        width: "100%", marginTop: 22, border: "none", cursor: "pointer", textAlign: "left",
        borderRadius: 22, padding: "22px 24px", position: "relative", overflow: "hidden",
        background: `linear-gradient(140deg, ${BCN.noche} 0%, ${BCN.mar} 100%)`,
        boxShadow: `0 8px 30px ${BCN.noche}30`,
      }}
    >
      <Trencadis />
      <div style={{ position: "relative" }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: BCN.sol, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 8px" }}>
          Cuando queráis recordarlo
        </p>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 26, color: "white", margin: 0, lineHeight: 1.15 }}>
          Nuestra Barcelona
        </p>
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", margin: "8px 0 0", lineHeight: 1.5, maxWidth: 340 }}>
          Vuestra etapa contada como lo que es: una historia, no una lista de datos.
        </p>
      </div>
    </motion.button>
  );
}

/* ─── Guardar momento ──────────────────────────────────────── */

function BotonMomento({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, type: "spring", stiffness: 280, damping: 22 }}
      whileTap={{ scale: 0.94 }} onClick={onClick}
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: `calc(24px + env(safe-area-inset-bottom))`,
        border: "none", cursor: "pointer", borderRadius: 30,
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 9,
        background: BCN.tinta, color: "white",
        boxShadow: "0 8px 26px rgba(44,36,32,0.34)", zIndex: 90,
      }}
    >
      <span style={{ fontSize: 17 }}>📸</span>
      <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.2px" }}>Guardar momento</span>
    </motion.button>
  );
}

/* ─── Sin etapa ────────────────────────────────────────────── */

function SinEtapa() {
  return (
    <div style={{ textAlign: "center", padding: "50px 24px" }}>
      <p style={{ fontSize: 46, margin: 0 }}>🇪🇸</p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 21, color: BCN.tinta, margin: "16px 0 8px" }}>
        Todavía no hay ninguna etapa
      </p>
      <p style={{ fontSize: 14.5, color: BCN.humo, margin: 0, lineHeight: 1.6 }}>
        Ejecuta <code style={{ background: "white", padding: "2px 6px", borderRadius: 5, border: `1px solid ${BCN.arenaOsc}`, fontSize: 13 }}>supabase-barcelona.sql</code> en Supabase
        para crear las tablas y la etapa Barcelona 2026.
      </p>
    </div>
  );
}

/* ─── Estilos compartidos ──────────────────────────────────── */

const numeroGrande: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 46, fontWeight: 400, color: "white", lineHeight: 1,
  textShadow: "0 2px 14px rgba(0,0,0,0.2)",
};

const numeroTexto: React.CSSProperties = {
  fontSize: 14, color: "rgba(255,255,255,0.82)", fontWeight: 500,
};

const etiqueta: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, color: BCN.humo,
  textTransform: "uppercase", letterSpacing: "0.13em", margin: "0 0 10px",
};
