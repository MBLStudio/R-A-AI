"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, type Momento, type Etapa } from "@/lib/barcelona/types";
import { getEtapaActiva, getHistoria, deleteMomento } from "@/lib/barcelona/queries";
import { Pantalla, Vacio, IconoMas } from "@/components/barcelona/Shell";

export default function HistoriaPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);
    setMomentos(await getHistoria(e.id));
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Agrupar por mes, del más reciente al más antiguo
  const grupos = momentos.reduce<{ mes: string; items: Momento[] }[]>((acc, m) => {
    const mes = new Date(m.fecha + "T12:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" });
    const ultimo = acc[acc.length - 1];
    if (ultimo && ultimo.mes === mes) ultimo.items.push(m);
    else acc.push({ mes, items: [m] });
    return acc;
  }, []);

  const borrar = async (id: string) => {
    await deleteMomento(id);
    setMomentos((prev) => prev.filter((m) => m.id !== id));
    setAbierto(null);
  };

  return (
    <Pantalla
      titulo="Nuestra historia"
      subtitulo={momentos.length > 0 ? `${momentos.length} ${momentos.length === 1 ? "momento guardado" : "momentos guardados"}` : "Todo lo que vais viviendo"}
      color={BCN.teja}
      accion={{ icon: IconoMas, label: "Añadir momento", onClick: () => router.push(`/${user}/barcelona/momento`) }}
    >
      {cargando ? (
        <Esqueleto />
      ) : momentos.length === 0 ? (
        <Vacio
          icon="📖"
          titulo="Vuestra historia empieza aquí"
          texto="Cada foto, cada nota y cada sitio que os marque se guarda en esta línea del tiempo."
          accion={{ label: "Guardar el primer momento", onClick: () => router.push(`/${user}/barcelona/momento`) }}
        />
      ) : (
        <div style={{ position: "relative" }}>
          {/* Hilo vertical */}
          <div style={{ position: "absolute", left: 19, top: 30, bottom: 10, width: 2, background: `linear-gradient(180deg, ${BCN.teja}55 0%, ${BCN.arenaOsc} 100%)` }} />

          {grupos.map((grupo, gi) => (
            <div key={grupo.mes}>
              <p style={{
                fontSize: 11, fontWeight: 800, color: BCN.humo, textTransform: "uppercase",
                letterSpacing: "0.12em", margin: gi === 0 ? "0 0 14px 48px" : "26px 0 14px 48px",
              }}>
                {grupo.mes}
              </p>

              {grupo.items.map((m, i) => (
                <Nodo
                  key={m.id}
                  momento={m}
                  delay={Math.min(0.03 * (gi * 3 + i), 0.4)}
                  abierto={abierto === m.id}
                  onToggle={() => setAbierto(abierto === m.id ? null : m.id)}
                  onBorrar={() => borrar(m.id)}
                />
              ))}
            </div>
          ))}

          {etapa?.fecha_llegada && (
            <p style={{ fontSize: 12, color: BCN.humo, textAlign: "center", marginTop: 28, fontStyle: "italic" }}>
              Todo empezó el {new Date(etapa.fecha_llegada + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      )}
    </Pantalla>
  );
}

function Nodo({ momento, delay, abierto, onToggle, onBorrar }: {
  momento: Momento; delay: number; abierto: boolean; onToggle: () => void; onBorrar: () => void;
}) {
  const cfg = TIPO_MOMENTO[momento.tipo] ?? TIPO_MOMENTO.otro;
  const dia = new Date(momento.fecha + "T12:00:00").getDate();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      style={{ display: "flex", gap: 14, marginBottom: 12, position: "relative" }}
    >
      {/* Punto en el hilo */}
      <div style={{
        width: 40, height: 40, borderRadius: momento.es_hito ? 12 : "50%",
        background: momento.es_hito ? cfg.color : "white",
        border: `2px solid ${cfg.color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, zIndex: 1,
        boxShadow: momento.es_hito ? `0 3px 12px ${cfg.color}55` : "0 1px 4px rgba(44,36,32,0.08)",
      }}>
        <span style={{ fontSize: momento.es_hito ? 17 : 15 }}>{cfg.icon}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button onClick={onToggle}
          style={{
            width: "100%", textAlign: "left", background: "white", cursor: "pointer",
            border: `1px solid ${momento.es_hito ? cfg.color + "44" : BCN.arenaOsc}`,
            borderRadius: 15, padding: "13px 15px",
            boxShadow: "0 2px 8px rgba(44,36,32,0.04)",
          }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: cfg.color, lineHeight: 1 }}>{dia}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {cfg.label}
            </span>
            {momento.es_hito && <span style={{ fontSize: 11 }}>⭐</span>}
          </div>

          <p style={{ fontSize: 15.5, fontWeight: 600, color: BCN.tinta, margin: 0, lineHeight: 1.35 }}>
            {momento.titulo}
          </p>

          {momento.lugar && (
            <p style={{ fontSize: 12.5, color: BCN.humo, margin: "3px 0 0" }}>📍 {momento.lugar}</p>
          )}

          {momento.nota && (
            <p style={{
              fontSize: 14, color: BCN.tinta, margin: "9px 0 0", lineHeight: 1.55, fontStyle: "italic",
              opacity: 0.85,
              ...(abierto ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }),
            }}>
              "{momento.nota}"
            </p>
          )}

          {momento.fotos.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }}>
              {momento.fotos.map((url) => (
                <img key={url} src={url} alt=""
                  style={{
                    width: abierto ? 130 : 74, height: abierto ? 130 : 74,
                    borderRadius: 10, objectFit: "cover", flexShrink: 0,
                    border: `1px solid ${BCN.arenaOsc}`, transition: "all 0.25s",
                  }} />
              ))}
            </div>
          )}
        </button>

        {abierto && (
          <motion.button
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            onClick={onBorrar}
            style={{ marginTop: 7, padding: "7px 13px", borderRadius: 18, background: "transparent", border: `1px solid ${BCN.arenaOsc}`, color: BCN.humo, fontSize: 12, cursor: "pointer" }}>
            Borrar este momento
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function Esqueleto() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: BCN.arenaOsc, flexShrink: 0 }} />
          <motion.div
            animate={{ opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
            style={{ flex: 1, height: 82, borderRadius: 15, background: BCN.arenaOsc }} />
        </div>
      ))}
    </div>
  );
}
