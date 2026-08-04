"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, type Momento, type Etapa } from "@/lib/barcelona/types";
import {
  getEtapaActiva, getAgenda, vivirMomento, deleteMomento, hoyISO, nombreDia, formatFechaLarga,
} from "@/lib/barcelona/queries";
import { Pantalla, Vacio, Hoja, Campo, estiloInput, Boton, IconoMas } from "@/components/barcelona/Shell";

export default function AgendaPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [viviendo, setViviendo] = useState<Momento | null>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setMomentos(await getAgenda(e.id));
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const hoy = hoyISO();
  const grupos = momentos.reduce<{ fecha: string; items: Momento[] }[]>((acc, m) => {
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.items.push(m);
    else acc.push({ fecha: m.fecha, items: [m] });
    return acc;
  }, []);

  const borrar = async (id: string) => {
    await deleteMomento(id);
    setMomentos((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <Pantalla
      titulo="Agenda"
      subtitulo={momentos.length > 0 ? `${momentos.length} ${momentos.length === 1 ? "plan" : "planes"} por delante` : "Lo que viene"}
      color={BCN.mar}
      accion={{ icon: IconoMas, label: "Añadir plan", onClick: () => router.push(`/${user}/barcelona/momento?plan=1`) }}
    >
      {cargando ? (
        <Cargando />
      ) : momentos.length === 0 ? (
        <Vacio
          icon="🗓️"
          titulo="Nada planeado todavía"
          texto="Una visita, una cena, un barrio por explorar. Lo que sea que os apetezca."
          accion={{ label: "Añadir un plan", onClick: () => router.push(`/${user}/barcelona/momento?plan=1`) }}
        />
      ) : (
        grupos.map((g, gi) => {
          const esHoy = g.fecha === hoy;
          const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
          const titulo = esHoy ? "Hoy" : g.fecha === manana ? "Mañana" : `${nombreDia(g.fecha)}, ${formatFechaLarga(g.fecha)}`;

          return (
            <div key={g.fecha} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <p style={{
                  fontSize: 11.5, fontWeight: 800, color: esHoy ? BCN.mar : BCN.humo,
                  textTransform: "uppercase", letterSpacing: "0.11em", margin: 0,
                }}>
                  {titulo}
                </p>
                {esHoy && <span style={{ width: 6, height: 6, borderRadius: "50%", background: BCN.mar }} />}
                <div style={{ flex: 1, height: 1, background: BCN.arenaOsc }} />
              </div>

              {g.items.map((m, i) => (
                <Plan
                  key={m.id} momento={m} delay={(gi * 2 + i) * 0.04}
                  onVivir={() => setViviendo(m)}
                  onBorrar={() => borrar(m.id)}
                />
              ))}
            </div>
          );
        })
      )}

      <HojaVivir
        momento={viviendo}
        onCerrar={() => setViviendo(null)}
        onGuardado={async () => { setViviendo(null); await cargar(); }}
        onVerHistoria={() => router.push(`/${user}/barcelona/historia`)}
      />
    </Pantalla>
  );
}

function Plan({ momento, delay, onVivir, onBorrar }: {
  momento: Momento; delay: number; onVivir: () => void; onBorrar: () => void;
}) {
  const cfg = TIPO_MOMENTO[momento.tipo] ?? TIPO_MOMENTO.otro;
  const [menu, setMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}
      style={{
        background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 15,
        padding: "13px 15px", marginBottom: 8, display: "flex", alignItems: "center", gap: 13,
        boxShadow: "0 2px 8px rgba(44,36,32,0.04)",
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cfg.color}16`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {cfg.icon}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: BCN.tinta, margin: 0, lineHeight: 1.3 }}>{momento.titulo}</p>
        <p style={{ fontSize: 12, color: BCN.humo, margin: "2px 0 0" }}>
          {momento.hora ? `${momento.hora.slice(0, 5)} · ` : ""}{cfg.label}
          {momento.lugar ? ` · ${momento.lugar}` : ""}
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={onVivir} aria-label="Marcar como vivido"
          style={{ width: 34, height: 34, borderRadius: "50%", background: `${BCN.teja}14`, border: `1px solid ${BCN.teja}33`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
          ✓
        </button>
        <button onClick={() => setMenu(!menu)} aria-label="Más opciones"
          style={{ width: 34, height: 34, borderRadius: "50%", background: BCN.arena, border: `1px solid ${BCN.arenaOsc}`, cursor: "pointer", color: BCN.humo, fontSize: 15, lineHeight: 1 }}>
          ⋯
        </button>
      </div>

      {menu && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          onClick={onBorrar}
          style={{ position: "absolute", right: 20, marginTop: 60, padding: "8px 14px", borderRadius: 10, background: "white", border: `1px solid ${BCN.arenaOsc}`, color: BCN.teja, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 14px rgba(44,36,32,0.12)", zIndex: 5 }}>
          Borrar
        </motion.button>
      )}
    </motion.div>
  );
}

/** Convertir un plan en recuerdo: solo pide lo que hace falta. */
function HojaVivir({ momento, onCerrar, onGuardado, onVerHistoria }: {
  momento: Momento | null; onCerrar: () => void; onGuardado: () => void; onVerHistoria: () => void;
}) {
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setNota(momento?.nota ?? ""); }, [momento]);

  const guardar = async () => {
    if (!momento) return;
    setGuardando(true);
    await vivirMomento(momento.id, nota.trim());
    setGuardando(false);
    onGuardado();
    onVerHistoria();
  };

  return (
    <Hoja abierta={!!momento} onCerrar={onCerrar} titulo="¿Cómo fue?">
      <p style={{ fontSize: 13.5, color: BCN.humo, margin: "-10px 0 18px", lineHeight: 1.55 }}>
        <strong style={{ color: BCN.tinta }}>{momento?.titulo}</strong> pasa a vuestra historia.
        Podéis añadir fotos luego desde la línea del tiempo.
      </p>

      <Campo label="Una nota, si os apetece">
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={4}
          placeholder="Mucho más bonito de lo esperado…"
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>

      <Boton onClick={guardar} disabled={guardando} color={BCN.teja}>
        {guardando ? "Guardando…" : "Guardar en nuestra historia"}
      </Boton>
    </Hoja>
  );
}

function Cargando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 68, borderRadius: 15, background: BCN.arenaOsc }} />
      ))}
    </div>
  );
}
