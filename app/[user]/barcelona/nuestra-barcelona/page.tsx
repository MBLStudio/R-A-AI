"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, type Etapa, type Momento } from "@/lib/barcelona/types";
import { getEtapaActiva, getHistoria, diasEnCiudad } from "@/lib/barcelona/queries";

export default function NuestraBarcelonaPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [texto, setTexto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [regenerando, setRegenerando] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const generar = useCallback(async (e: Etapa, force: boolean) => {
    try {
      const res = await fetch("/api/barcelona/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapaId: e.id, tipo: "narrativa", force }),
      });
      const data = await res.json();
      if (data.contenido) { setTexto(data.contenido); setError(false); }
      else setError(true);
    } catch { setError(true); }
  }, []);

  useEffect(() => {
    (async () => {
      const e = await getEtapaActiva();
      if (!e) { setCargando(false); return; }
      setEtapa(e);
      const h = await getHistoria(e.id);
      setMomentos(h);
      if (h.length > 0) await generar(e, false);
      setCargando(false);
    })();
  }, [generar]);

  const regenerar = async () => {
    if (!etapa) return;
    setRegenerando(true);
    await generar(etapa, true);
    setRegenerando(false);
  };

  const dias = etapa ? diasEnCiudad(etapa.fecha_llegada) : null;
  const hitos = momentos.filter((m) => m.es_hito);
  const fotos = momentos.flatMap((m) => m.fotos).slice(0, 6);

  return (
    <div style={{ height: "100dvh", background: BCN.noche, position: "relative", overflow: "hidden" }}>
      {/* Cielo de atardecer */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 380,
        background: `linear-gradient(180deg, ${BCN.noche} 0%, ${BCN.mar} 55%, ${BCN.tejaOsc} 100%)`,
        opacity: 0.9,
      }} />

      <Estrellas />

      <div style={{
        position: "relative", height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch",
        padding: "0 20px", paddingBottom: `calc(90px + env(safe-area-inset-bottom))`,
        maxWidth: 640, margin: "0 auto", boxSizing: "border-box",
      }}>
        {/* Cabecera */}
        <div style={{ paddingTop: `calc(16px + env(safe-area-inset-top))`, display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <button onClick={() => history.back()} aria-label="Volver"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.14)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {texto && (
            <button onClick={regenerar} disabled={regenerando}
              style={{ marginLeft: "auto", padding: "8px 15px", borderRadius: 20, background: "rgba(255,255,255,0.14)", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {regenerando ? "Reescribiendo…" : "Reescribir"}
            </button>
          )}
        </div>

        {/* Título */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          style={{ textAlign: "center", marginBottom: 44 }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: BCN.sol, textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 14px" }}>
            {etapa?.nombre ?? "Barcelona"}
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 400, color: "white", margin: 0, lineHeight: 1.08, letterSpacing: "-1px" }}>
            Nuestra<br />Barcelona
          </h1>
          {dias !== null && dias > 0 && (
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: "18px 0 0", fontStyle: "italic" }}>
              {dias} días · {momentos.length} {momentos.length === 1 ? "momento" : "momentos"}
              {hitos.length > 0 ? ` · ${hitos.length} ${hitos.length === 1 ? "hito" : "hitos"}` : ""}
            </p>
          )}
        </motion.div>

        {/* Mosaico de fotos */}
        {fotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.7 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 40 }}
          >
            {fotos.map((url, i) => (
              <div key={url} style={{
                aspectRatio: "1", borderRadius: 10, overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                transform: `rotate(${(i % 3 - 1) * 1.2}deg)`,
              }}>
                <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.92 }} />
              </div>
            ))}
          </motion.div>
        )}

        {/* El relato */}
        {cargando ? (
          <Escribiendo />
        ) : momentos.length === 0 ? (
          <Mensaje
            titulo="Todavía no hay historia que contar"
            texto="Guardad vuestros primeros momentos y aquí aparecerá el relato de esta etapa, escrito con lo que vayáis viviendo."
          />
        ) : texto ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
            style={{
              background: "rgba(247,240,230,0.97)", borderRadius: 22, padding: "32px 26px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
          >
            {texto.split("\n").filter((p) => p.trim()).map((parrafo, i) => (
              <p key={i} style={{
                fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.78,
                color: BCN.tinta, margin: i === 0 ? 0 : "18px 0 0",
              }}>
                {i === 0 ? (
                  <>
                    <span style={{ fontSize: 38, float: "left", lineHeight: 0.85, marginRight: 8, marginTop: 3, color: BCN.teja }}>
                      {parrafo.trim()[0]}
                    </span>
                    {parrafo.trim().slice(1)}
                  </>
                ) : parrafo.trim()}
              </p>
            ))}

            <div style={{ marginTop: 30, paddingTop: 18, borderTop: `1px solid ${BCN.arenaOsc}`, textAlign: "center" }}>
              <p style={{ fontSize: 12, color: BCN.humo, margin: 0, fontStyle: "italic" }}>
                Esta historia crece con vosotros. Volved cuando queráis.
              </p>
            </div>
          </motion.div>
        ) : (
          <Mensaje
            titulo={error ? "No se ha podido escribir" : "Sin relato todavía"}
            texto={error ? "Inténtalo otra vez en un momento." : "Guardad algún momento más y volved."}
          />
        )}
      </div>
    </div>
  );
}

function Estrellas() {
  const puntos = [
    { x: 12, y: 8 }, { x: 78, y: 5 }, { x: 45, y: 14 }, { x: 90, y: 18 },
    { x: 25, y: 22 }, { x: 62, y: 26 }, { x: 8, y: 30 }, { x: 84, y: 34 },
  ];
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 340, pointerEvents: "none" }} aria-hidden>
      {puntos.map((p, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 2.6 + (i % 3), repeat: Infinity, delay: i * 0.35 }}
          style={{
            position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
            width: 2.5, height: 2.5, borderRadius: "50%", background: "white",
          }} />
      ))}
    </div>
  );
}

function Escribiendo() {
  return (
    <div style={{ background: "rgba(247,240,230,0.97)", borderRadius: 22, padding: "32px 26px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
      {[100, 96, 88, 100, 72].map((w, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 0.65, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.13 }}
          style={{ height: 13, width: `${w}%`, borderRadius: 6, background: BCN.arenaOsc, marginBottom: 13 }} />
      ))}
      <p style={{ fontSize: 12.5, color: BCN.humo, margin: "8px 0 0", textAlign: "center", fontStyle: "italic" }}>
        Escribiendo vuestra historia…
      </p>
    </div>
  );
}

function Mensaje({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ background: "rgba(247,240,230,0.97)", borderRadius: 22, padding: "40px 26px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 19, color: BCN.tinta, margin: "0 0 9px" }}>{titulo}</p>
      <p style={{ fontSize: 14, color: BCN.humo, margin: 0, lineHeight: 1.6 }}>{texto}</p>
    </div>
  );
}
