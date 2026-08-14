"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { Media } from "@/components/barcelona/Media";
import type { UserName } from "@/store/userStore";

/* ═══════════════════════════════════════════════════════════
   Lo que Olmo os dice hoy, en un bocadillo.

   Sale de su icono, como si acabara de hablar. Antes esto era
   una tarjeta enorme en medio del panel y se comía la pantalla:
   lo que dice cabe en tres frases y no tiene por qué ocupar más
   que eso.

   Una al día. Si lo cerráis, no vuelve hasta mañana — para eso
   se apunta el día en el propio móvil, que es cosa de cada uno:
   lo que Olmo dice es de los dos, pero haberlo leído ya no.
   ═══════════════════════════════════════════════════════════ */

interface Tarjeta {
  texto: string;
  foto: { url: string; titulo: string; fecha: string } | null;
  accion: { seccion: string; etiqueta: string } | null;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
const LLAVE = "olmo-leido";

export function BocadilloOlmo({ etapaId, usuario, onAbrirChat }: {
  etapaId: string | null;
  usuario: UserName;
  onAbrirChat: () => void;
}) {
  const router = useRouter();
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [visible, setVisible] = useState(false);

  const pedir = useCallback(async () => {
    if (!etapaId) return;

    // ¿Ya lo ha leído hoy en este móvil?
    try {
      if (localStorage.getItem(LLAVE) === hoyISO()) return;
    } catch { /* modo incógnito y demás: se enseña igual */ }

    try {
      const res = await fetch("/api/barcelona/olmo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapaId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as Tarjeta & { error?: string };
      if (data.error || !data.texto) return;

      setTarjeta(data);
      // Un momento de margen: que la pantalla se asiente antes de
      // que aparezca nadie hablando.
      setTimeout(() => setVisible(true), 900);
    } catch {
      // Sin conexión no pasa nada: el bocadillo simplemente no sale
    }
  }, [etapaId]);

  useEffect(() => { pedir(); }, [pedir]);

  const cerrar = () => {
    setVisible(false);
    try { localStorage.setItem(LLAVE, hoyISO()); } catch {}
  };

  if (!tarjeta) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 8 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{
            position: "fixed",
            right: 16,
            // Justo encima del icono, que mide 78
            bottom: `calc(20px + env(safe-area-inset-bottom) + 92px)`,
            width: "min(76vw, 304px)",
            // Por debajo del icono (80) y del chat (200): al abrir la
            // conversación se queda tapado solo, sin tener que avisarle.
            zIndex: 79,
            transformOrigin: "bottom right",
            background: "white",
            borderRadius: 18,
            border: `1px solid ${BCN.arenaOsc}`,
            boxShadow: "0 10px 30px rgba(44,36,32,0.18), 0 2px 8px rgba(44,36,32,0.1)",
          }}
        >
          {/* La colita, apuntando al icono */}
          <span style={{
            position: "absolute", bottom: -7, right: 31,
            width: 14, height: 14, background: "white",
            borderRight: `1px solid ${BCN.arenaOsc}`,
            borderBottom: `1px solid ${BCN.arenaOsc}`,
            transform: "rotate(45deg)",
            borderBottomRightRadius: 3,
          }} />

          <button
            onClick={cerrar}
            aria-label="Cerrar"
            style={{
              position: "absolute", top: 6, right: 6,
              width: 24, height: 24, borderRadius: "50%",
              border: "none", background: "transparent", cursor: "pointer",
              color: BCN.humo, fontSize: 15, lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>

          <button
            onClick={onAbrirChat}
            style={{
              display: "block", width: "100%", textAlign: "left",
              border: "none", background: "transparent", cursor: "pointer",
              padding: "13px 15px 12px",
            }}
          >
            <span style={{
              display: "block", fontSize: 9.5, fontWeight: 800, color: BCN.teja,
              textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 7,
            }}>
              Olmo
            </span>

            <span style={{
              display: "block", fontSize: 13.5, color: BCN.tinta,
              lineHeight: 1.55, letterSpacing: "-0.1px",
            }}>
              {tarjeta.texto}
            </span>
          </button>

          {tarjeta.foto && (
            <div style={{ padding: "0 15px 12px" }}>
              <div style={{ width: "100%", height: 112, borderRadius: 11, overflow: "hidden" }}>
                <Media url={tarjeta.foto.url} style={{ width: "100%", height: "100%" }} />
              </div>
            </div>
          )}

          {tarjeta.accion && (
            <button
              onClick={() => {
                cerrar();
                router.push(`/${usuario}/barcelona/${tarjeta.accion!.seccion}`);
              }}
              style={{
                width: "100%", padding: "11px 15px", border: "none", cursor: "pointer",
                borderTop: `1px solid ${BCN.teja}1E`,
                background: `${BCN.teja}0C`, textAlign: "left",
                borderRadius: "0 0 17px 17px",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 650, color: BCN.teja }}>
                {tarjeta.accion.etiqueta}
              </span>
              <span style={{ marginLeft: "auto", color: BCN.teja, fontSize: 15 }}>›</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
