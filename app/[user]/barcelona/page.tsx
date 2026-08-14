"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, pintarMomento } from "@/lib/barcelona/types";
import type { Etapa, Barrio, Momento, Valoracion, Contacto } from "@/lib/barcelona/types";
import { rankear } from "@/lib/barcelona/compat";
import {
  getEtapaActiva, getSnapshot, diasEnCiudad, formatFechaCorta, nombreDia, hoyISO,
} from "@/lib/barcelona/queries";
import { Fondo, HojaFondos } from "@/components/barcelona/Fondo";
import { Asistente } from "@/components/barcelona/Asistente";

/* ═══════════════════════════════════════════════════════════
   Proyecto Barcelona — el índice del capítulo.
   Un vistazo y sabes dónde estás. Nada más.
   ═══════════════════════════════════════════════════════════ */

interface Fila {
  id: string;
  titulo: string;
  sub: string;
  icon: string;
  color: string;
}

const SECCIONES: { titulo: string; filas: Fila[] }[] = [
  {
    titulo: "El viaje",
    filas: [
      { id: "agenda",   titulo: "Calendario",      sub: "Día a día, lo que hay planeado", icon: "📅", color: BCN.mar },
      { id: "historia", titulo: "Nuestra historia", sub: "Lo que ya habéis vivido",        icon: "📖", color: BCN.teja },
    ],
  },
  {
    titulo: "Decidir",
    filas: [
      { id: "barrios",  titulo: "Barrios",  sub: "Valorados por los dos",     icon: "🌆", color: BCN.sol },
      { id: "gastos",   titulo: "Gastos",   sub: "El bote y quién pone qué",  icon: "💶", color: BCN.oliva },
    ],
  },
  {
    titulo: "Recordar",
    filas: [
      { id: "mapa",         titulo: "Mapa",         sub: "Vuestra Barcelona sobre el plano", icon: "🗺️", color: BCN.marClaro },
      { id: "contactos",    titulo: "Contactos",    sub: "Quién os ayudó",             icon: "📇", color: BCN.humo },
    ],
  },
];

export default function BarcelonaPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [valoraciones, setValoraciones] = useState<Valoracion[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinEtapa, setSinEtapa] = useState(false);
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  // Cambia cuando se toca la foto de cabecera, para que se vuelva a leer
  const [versionFoto, setVersionFoto] = useState(0);

  useEffect(() => {
    if (user && user !== activeUser) setUser(user, user);
  }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setSinEtapa(true); setCargando(false); return; }
    const snap = await getSnapshot(e);
    setEtapa(snap.etapa);
    setBarrios(snap.barrios);
    setMomentos(snap.momentos);
    setValoraciones(snap.valoraciones);
    setContactos(snap.contactos);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const dias = etapa ? diasEnCiudad(etapa.fecha_llegada) : null;
  const hoy = hoyISO();
  const vividos = momentos.filter((m) => m.estado === "vivido");
  const proximos = momentos
    .filter((m) => m.estado === "previsto" && m.fecha >= hoy)
    .sort((a, b) => (a.fecha + (a.hora ?? "")).localeCompare(b.fecha + (b.hora ?? "")));

  const ranking = rankear(barrios, valoraciones.filter((v) => v.entidad_tipo === "barrio"));
  const mejorBarrio = ranking.find((r) => r.compat.porcentaje !== null);

  const ir = (id: string) => router.push(`/${user}/barcelona/${id}`);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BCN.arena, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>

        <Cabecera
          etapa={etapa}
          etapaId={etapa?.id ?? null}
          versionFoto={versionFoto}
          dias={dias}
          onBack={() => router.push(`/${user}`)}
          onAjustes={() => ir("ajustes")}
          onFoto={() => setEligiendoFoto(true)}
        />

        <div style={{
          padding: "0 16px",
          paddingBottom: `calc(40px + env(safe-area-inset-bottom))`,
          maxWidth: 640, margin: "0 auto",
        }}>
          {sinEtapa ? (
            <SinEtapa />
          ) : (
            <>
              {/* Lo próximo */}
              {proximos.length > 0 && (
                <Proximo momento={proximos[0]} onClick={() => ir("agenda")} />
              )}

              {/* Pulso */}
              {!cargando && (
                <Pulso
                  momentos={vividos.length}
                  barrios={ranking.filter((r) => r.compat.porcentaje !== null).length}
                  contactos={contactos.length}
                  mejorBarrio={mejorBarrio?.entidad.nombre ?? null}
                  mejorPct={mejorBarrio?.compat.porcentaje ?? null}
                  onBarrios={() => ir("barrios")}
                />
              )}

              {/* Secciones */}
              {SECCIONES.map((s, si) => (
                <section key={s.titulo} style={{ marginTop: si === 0 ? 26 : 22 }}>
                  <p style={etiqueta}>{s.titulo}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 16, overflow: "hidden", border: `1px solid ${BCN.arenaOsc}` }}>
                    {s.filas.map((f, i) => (
                      <FilaLista
                        key={f.id}
                        fila={f}
                        delay={0.03 * (si * 3 + i)}
                        ultima={i === s.filas.length - 1}
                        onClick={() => ir(f.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {/* El libro */}
              <Libro onClick={() => ir("nuestra-barcelona")} />
            </>
          )}
        </div>
      </div>

      {/* El asistente vive flotando en la esquina */}
      {!sinEtapa && <Asistente etapa={etapa} usuario={user} />}

      <HojaFondos
        abierta={eligiendoFoto}
        etapaId={etapa?.id ?? null}
        onCerrar={() => setEligiendoFoto(false)}
        onCambio={() => setVersionFoto((n) => n + 1)}
      />
    </div>
  );
}

/* ─── Cabecera ─────────────────────────────────────────────── */

function Cabecera({ etapa, etapaId, versionFoto, dias, onBack, onAjustes, onFoto }: {
  etapa: Etapa | null; etapaId: string | null; versionFoto: number; dias: number | null;
  onBack: () => void; onAjustes: () => void; onFoto: () => void;
}) {
  const titulo = etapa?.subtitulo ?? "Catalanes por una temporada";

  return (
    <div style={{ position: "relative", overflow: "hidden", marginBottom: 20 }}>
      <Fondo key={versionFoto} etapaId={etapaId} onGestionar={onFoto} />

      {/* Velo para que el texto se lea sobre cualquier foto */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(20,14,10,0.55) 0%, rgba(20,14,10,0.15) 42%, rgba(20,14,10,0.62) 100%)",
      }} />

      <div style={{
        position: "relative",
        padding: "16px 20px 34px",
        paddingTop: `calc(16px + env(safe-area-inset-top))`,
        minHeight: 230,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} aria-label="Volver" style={botonCabecera}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.82)", letterSpacing: "0.15em", textTransform: "uppercase", textShadow: "0 1px 6px rgba(0,0,0,0.3)" }}>
            Proyecto Barcelona
          </span>
          <button onClick={onAjustes} aria-label="Ajustes" style={{ ...botonCabecera, marginLeft: "auto" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" />
              <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ marginTop: "auto" }}>
          <motion.h1
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 33, fontWeight: 400,
              color: "white", margin: 0, lineHeight: 1.12, letterSpacing: "-0.5px",
              textShadow: "0 2px 16px rgba(0,0,0,0.4)",
            }}
          >
            {titulo}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}
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
      </div>

      {/* Ola de separación */}
      <svg viewBox="0 0 400 20" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 20, position: "relative", marginTop: -1 }}>
        <path d="M0,12 C60,2 120,18 200,10 C280,2 340,16 400,8 L400,20 L0,20 Z" fill={BCN.arena} />
      </svg>
    </div>
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
  const cfg = pintarMomento(momento.tipo, momento.titulo);

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{
        width: "100%", marginTop: 10, border: `1px solid ${BCN.arenaOsc}`, cursor: "pointer", textAlign: "left",
        borderRadius: 16, padding: "14px 16px", background: "white",
        display: "flex", alignItems: "center", gap: 13,
        boxShadow: "0 2px 10px rgba(44,36,32,0.05)",
      }}
    >
      <div style={{ width: 42, height: 42, borderRadius: 13, background: `${cfg.color}16`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>
        {cfg.icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
          {cuando}{momento.hora ? ` · ${momento.hora.slice(0, 5)}` : ""}
        </p>
        <p style={{ fontSize: 15.5, fontWeight: 600, color: BCN.tinta, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {momento.titulo}
        </p>
      </div>
      <span style={{ color: BCN.humo, fontSize: 19 }}>›</span>
    </motion.button>
  );
}

/* ─── Pulso ────────────────────────────────────────────────── */

function Pulso({ momentos, barrios, contactos, mejorBarrio, mejorPct, onBarrios }: {
  momentos: number; barrios: number; contactos: number;
  mejorBarrio: string | null; mejorPct: number | null; onBarrios: () => void;
}) {
  const datos = [
    { n: momentos,  label: momentos === 1 ? "momento" : "momentos" },
    { n: barrios,   label: barrios === 1 ? "barrio" : "barrios" },
    { n: contactos, label: contactos === 1 ? "contacto" : "contactos" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
      style={{ marginTop: 10 }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        {datos.map((d) => (
          <div key={d.label} style={{
            flex: 1, background: "white", borderRadius: 13,
            border: `1px solid ${BCN.arenaOsc}`, padding: "10px 5px", textAlign: "center",
          }}>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 20, color: d.n > 0 ? BCN.teja : BCN.arenaOsc, margin: 0, lineHeight: 1 }}>
              {d.n}
            </p>
            <p style={{ fontSize: 9.5, color: BCN.humo, margin: "4px 0 0" }}>{d.label}</p>
          </div>
        ))}
      </div>

      {mejorBarrio && mejorPct !== null && (
        <button onClick={onBarrios}
          style={{
            width: "100%", marginTop: 7, padding: "10px 14px", borderRadius: 13,
            background: `${BCN.teja}0E`, border: `1px solid ${BCN.teja}26`,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left",
          }}>
          <span style={{ fontSize: 14 }}>❤️</span>
          <span style={{ fontSize: 13, color: BCN.tinta }}>
            <strong style={{ fontWeight: 700 }}>{mejorBarrio}</strong> va ganando
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "Georgia, serif", fontSize: 15, color: BCN.teja }}>
            {mejorPct}%
          </span>
        </button>
      )}
    </motion.div>
  );
}

/* ─── Fila estilo Notion ───────────────────────────────────── */

function FilaLista({ fila, delay, ultima, onClick }: {
  fila: Fila; delay: number; ultima: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileTap={{ backgroundColor: BCN.arena }}
      onClick={onClick}
      style={{
        width: "100%", background: "white", border: "none", cursor: "pointer", textAlign: "left",
        padding: "14px 15px", display: "flex", alignItems: "center", gap: 13,
        borderBottom: ultima ? "none" : `1px solid ${BCN.arena}`,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `${fila.color}18`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
      }}>
        {fila.icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: BCN.tinta, margin: 0, lineHeight: 1.3 }}>
          {fila.titulo}
        </p>
        <p style={{ fontSize: 12.5, color: BCN.humo, margin: "1px 0 0" }}>{fila.sub}</p>
      </div>
      <span style={{ color: BCN.arenaOsc, fontSize: 18 }}>›</span>
    </motion.button>
  );
}


function Libro({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
      whileTap={{ scale: 0.98 }} onClick={onClick}
      style={{
        width: "100%", marginTop: 26, border: "none", cursor: "pointer", textAlign: "left",
        borderRadius: 16, padding: 0, background: "transparent",
        display: "flex", alignItems: "stretch",
        boxShadow: "0 6px 22px rgba(35,48,59,0.26)",
        overflow: "hidden",
      }}
    >
      {/* Lomo del libro */}
      <div style={{
        width: 26, flexShrink: 0,
        background: `linear-gradient(90deg, ${BCN.tejaOsc} 0%, ${BCN.teja} 60%, ${BCN.tejaOsc} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: 2, height: "72%", background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
      </div>

      {/* Portada */}
      <div style={{
        flex: 1, padding: "20px 20px 22px",
        background: `linear-gradient(140deg, ${BCN.noche} 0%, ${BCN.mar} 100%)`,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: BCN.sol, textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 9px" }}>
          Vuestro libro
        </p>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 24, color: "white", margin: 0, lineHeight: 1.15 }}>
          Nuestra Barcelona
        </p>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", margin: "8px 0 0", lineHeight: 1.5 }}>
          Vuestra etapa contada como una historia. Página a página.
        </p>
      </div>
    </motion.button>
  );
}

/* ─── Sin etapa ────────────────────────────────────────────── */

function SinEtapa() {
  return (
    <div style={{ textAlign: "center", padding: "44px 24px" }}>
      <p style={{ fontSize: 44, margin: 0 }}>🇪🇸</p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 20, color: BCN.tinta, margin: "16px 0 8px" }}>
        Todavía no hay ninguna etapa
      </p>
      <p style={{ fontSize: 14, color: BCN.humo, margin: 0, lineHeight: 1.6 }}>
        Ejecuta <code style={{ background: "white", padding: "2px 6px", borderRadius: 5, border: `1px solid ${BCN.arenaOsc}`, fontSize: 13 }}>supabase-barcelona.sql</code> en Supabase.
      </p>
    </div>
  );
}

/* ─── Estilos ──────────────────────────────────────────────── */

const botonCabecera: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
  border: "none", cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", backdropFilter: "blur(8px)", flexShrink: 0,
};

const numeroGrande: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 42, fontWeight: 400, color: "white", lineHeight: 1,
  textShadow: "0 2px 16px rgba(0,0,0,0.35)",
};

const numeroTexto: React.CSSProperties = {
  fontSize: 14, color: "rgba(255,255,255,0.88)", fontWeight: 500,
  textShadow: "0 1px 8px rgba(0,0,0,0.3)",
};

const etiqueta: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, color: BCN.humo,
  textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 9px 3px",
};
