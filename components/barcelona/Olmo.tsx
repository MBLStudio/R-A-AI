"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { Visor, useVisor } from "@/components/barcelona/Visor";
import { Media } from "@/components/barcelona/Media";

/* ═══════════════════════════════════════════════════════════
   Lo que Olmo os dice hoy.

   Lo primero que veis al abrir Barcelona. No espera a que le
   preguntéis: mira todo lo guardado y elige él qué contaros,
   y a veces saca una foto vuestra.

   Es una al día. El botón de al lado la cambia si queréis
   otra cosa, pero no hace falta tocarlo: mañana habrá otra.
   ═══════════════════════════════════════════════════════════ */

interface Tarjeta {
  texto: string;
  foto: { url: string; titulo: string; fecha: string } | null;
  accion: { seccion: string; etiqueta: string } | null;
}

export function OlmoHoy({ etapaId, onIr }: {
  etapaId: string | null;
  onIr: (seccion: string) => void;
}) {
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [avatar, setAvatar] = useState(false);
  const visor = useVisor();

  useEffect(() => {
    const img = new Image();
    img.onload = () => setAvatar(true);
    img.src = "/asistente.webp";
  }, []);

  const pedir = useCallback(async (force: boolean) => {
    if (!etapaId) return;
    if (force) setRefrescando(true);

    try {
      const res = await fetch("/api/barcelona/olmo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapaId, force }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Tarjeta & { error?: string };
      if (data.error || !data.texto) throw new Error();
      setTarjeta(data);
    } catch {
      // Sin conexión o con la API caída: mejor no enseñar nada
      // que enseñar un hueco roto. El resto del hub sigue igual.
      setTarjeta(null);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [etapaId]);

  useEffect(() => { pedir(false); }, [pedir]);

  if (!etapaId) return null;

  if (cargando) {
    return (
      <div style={{
        marginTop: 10, borderRadius: 18, padding: "16px 17px",
        background: `linear-gradient(150deg, #fff 0%, ${BCN.arena} 100%)`,
        border: `1px solid ${BCN.teja}24`,
      }}>
        <motion.div
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div style={{ height: 11, width: 62, borderRadius: 6, background: BCN.arenaOsc }} />
          <div style={{ height: 13, width: "94%", borderRadius: 6, background: BCN.arenaOsc, marginTop: 14 }} />
          <div style={{ height: 13, width: "72%", borderRadius: 6, background: BCN.arenaOsc, marginTop: 8 }} />
        </motion.div>
      </div>
    );
  }

  if (!tarjeta) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          marginTop: 10, borderRadius: 18, overflow: "hidden",
          background: `linear-gradient(150deg, #fff 0%, ${BCN.arena} 100%)`,
          border: `1px solid ${BCN.teja}24`,
          boxShadow: "0 3px 16px rgba(44,36,32,0.06)",
        }}
      >
        <div style={{ padding: "14px 16px 15px" }}>
          {/* Quién habla */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: BCN.noche, display: "flex", alignItems: "center", justifyContent: "center",
              backgroundImage: avatar ? "url(/asistente.webp)" : undefined,
              backgroundSize: "cover", backgroundPosition: "center",
            }}>
              {!avatar && <span style={{ fontSize: 11 }}>🫒</span>}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 800, color: BCN.teja,
              textTransform: "uppercase", letterSpacing: "0.15em",
            }}>
              Olmo
            </span>

            <button
              onClick={() => pedir(true)}
              disabled={refrescando}
              aria-label="Que diga otra cosa"
              style={{
                marginLeft: "auto", width: 26, height: 26, borderRadius: "50%",
                border: "none", background: "transparent", cursor: "pointer",
                color: BCN.humo, fontSize: 14, lineHeight: 1, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <motion.span
                animate={refrescando ? { rotate: 360 } : { rotate: 0 }}
                transition={refrescando ? { duration: 0.9, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}
                style={{ display: "block" }}
              >
                ↻
              </motion.span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={tarjeta.texto}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: 14.5, color: BCN.tinta, margin: 0,
                lineHeight: 1.62, letterSpacing: "-0.1px",
              }}
            >
              {tarjeta.texto}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* La foto que ha querido enseñar */}
        {tarjeta.foto && (
          <button
            onClick={() => visor.abrir(0)}
            style={{
              display: "block", width: "100%", border: "none", padding: "0 12px",
              background: "transparent", cursor: "pointer",
            }}
          >
            <div style={{
              position: "relative", width: "100%", height: 168,
              borderRadius: 13, overflow: "hidden",
            }}>
              <Media url={tarjeta.foto.url} style={{ width: "100%", height: "100%" }} />
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                padding: "22px 12px 9px", textAlign: "left",
                background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.62))",
              }}>
                <p style={{ fontSize: 12.5, color: "white", margin: 0, fontWeight: 600 }}>
                  {tarjeta.foto.titulo}
                </p>
              </div>
            </div>
          </button>
        )}

        {/* A dónde os manda */}
        {tarjeta.accion && (
          <button
            onClick={() => onIr(tarjeta.accion!.seccion)}
            style={{
              width: "100%", marginTop: tarjeta.foto ? 12 : 0,
              padding: "12px 16px", border: "none", cursor: "pointer",
              borderTop: `1px solid ${BCN.teja}1E`,
              background: `${BCN.teja}0C`, textAlign: "left",
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 650, color: BCN.teja }}>
              {tarjeta.accion.etiqueta}
            </span>
            <span style={{ marginLeft: "auto", color: BCN.teja, fontSize: 16 }}>›</span>
          </button>
        )}
      </motion.div>

      {tarjeta.foto && (
        <Visor fotos={[tarjeta.foto.url]} indice={visor.indice} onCerrar={visor.cerrar} />
      )}
    </>
  );
}
