"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, type Etapa } from "@/lib/barcelona/types";
import { getEtapaActiva, claveSemana } from "@/lib/barcelona/queries";
import { Pantalla, Vacio } from "@/components/barcelona/Shell";

export default function ResumenSemanalPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [regenerando, setRegenerando] = useState(false);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const generar = useCallback(async (e: Etapa, force: boolean) => {
    try {
      const res = await fetch("/api/barcelona/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapaId: e.id, tipo: "semanal", clave: `semana-${claveSemana()}`, force }),
      });
      const data = await res.json();
      setTexto(data.contenido ?? null);
    } catch { setTexto(null); }
  }, []);

  useEffect(() => {
    (async () => {
      const e = await getEtapaActiva();
      if (!e) { setCargando(false); return; }
      setEtapa(e);
      await generar(e, false);
      setCargando(false);
    })();
  }, [generar]);

  const semana = claveSemana();

  return (
    <Pantalla titulo="Resumen semanal" subtitulo={`Semana ${semana.split("-W")[1]} · ${semana.split("-")[0]}`} color={BCN.oliva}>
      {cargando ? (
        <Escribiendo />
      ) : !etapa ? (
        <Vacio icon="📊" titulo="Sin etapa" texto="Ejecuta el SQL de Barcelona primero." />
      ) : texto ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{
              background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 20,
              padding: "24px 22px", borderTop: `4px solid ${BCN.oliva}`,
              boxShadow: "0 4px 20px rgba(44,36,32,0.06)",
            }}
          >
            {texto.split("\n").filter((l) => l.trim()).map((linea, i) => {
              const esObjetivo = /^pr[óo]ximo objetivo:/i.test(linea.trim());
              return (
                <p key={i} style={{
                  fontSize: 15.5, lineHeight: 1.68, margin: i === 0 ? 0 : "12px 0 0",
                  color: esObjetivo ? BCN.oliva : BCN.tinta,
                  fontWeight: esObjetivo ? 600 : 400,
                  ...(esObjetivo ? { marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BCN.arena}` } : {}),
                }}>
                  {linea.trim()}
                </p>
              );
            })}
          </motion.div>

          <button
            onClick={async () => { if (!etapa) return; setRegenerando(true); await generar(etapa, true); setRegenerando(false); }}
            disabled={regenerando}
            style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 14, background: "transparent", border: `1px solid ${BCN.arenaOsc}`, color: BCN.humo, fontSize: 13.5, cursor: "pointer" }}>
            {regenerando ? "Reescribiendo…" : "Volver a generarlo"}
          </button>

          <p style={{ fontSize: 12, color: BCN.humo, textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>
            Se escribe una vez por semana y se guarda. Cada domingo tendréis uno nuevo.
          </p>
        </>
      ) : (
        <Vacio icon="📊" titulo="Nada que resumir" texto="Guardad algún momento esta semana y vuelve por aquí." />
      )}
    </Pantalla>
  );
}

function Escribiendo() {
  return (
    <div style={{ background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 20, padding: "24px 22px" }}>
      {[100, 92, 84, 96, 70].map((w, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.13 }}
          style={{ height: 12, width: `${w}%`, borderRadius: 6, background: BCN.arenaOsc, marginBottom: 12 }} />
      ))}
    </div>
  );
}
