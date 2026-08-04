"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BCN, type Etapa } from "@/lib/barcelona/types";
import type { UserName } from "@/store/userStore";

/* ═══════════════════════════════════════════════════════════
   El asistente.

   Un botón flotante en la esquina. Al pulsarlo, el fondo se
   oscurece y se abre el copiloto a pantalla casi completa,
   con una X arriba a la derecha para salir.

   El avatar: si existe /asistente.png se usa esa imagen; si
   no, el futbolista dibujado de abajo. Para cambiarlo basta
   con dejar el PNG en /public — no hay que tocar código.
   ═══════════════════════════════════════════════════════════ */

interface Mensaje { role: "user" | "assistant"; content: string }

const SUGERENCIAS = [
  "¿Cómo vamos?",
  "¿Qué barrio nos encaja más?",
  "¿Qué tenemos pendiente?",
  "¿Qué hacemos mañana?",
];

export function Asistente({ etapa, usuario }: { etapa: Etapa | null; usuario: UserName }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [hayFoto, setHayFoto] = useState(false);
  const [ampliada, setAmpliada] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // ¿Han dejado una imagen propia en /public/asistente.png?
  useEffect(() => {
    const img = new Image();
    img.onload = () => setHayFoto(true);
    img.onerror = () => setHayFoto(false);
    img.src = "/asistente.png";
  }, []);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, pensando, abierto]);

  // Con el asistente abierto, el fondo no se mueve.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, [abierto]);

  const enviar = useCallback(async (contenido: string) => {
    if (!contenido.trim() || pensando || !etapa) return;

    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: contenido.trim() }];
    setMensajes(nuevos);
    setTexto("");
    setPensando(true);

    try {
      const res = await fetch("/api/barcelona/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nuevos, etapaId: etapa.id, usuario }),
      });
      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acumulado = "";

      setMensajes((prev) => [...prev, { role: "assistant", content: "" }]);
      setPensando(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const linea of decoder.decode(value).split("\n")) {
          if (linea.startsWith("data: ") && linea.slice(6) !== "[DONE]") {
            try {
              const t = JSON.parse(linea.slice(6)).text;
              if (t) {
                acumulado += t;
                setMensajes((prev) => {
                  const copia = [...prev];
                  copia[copia.length - 1] = { role: "assistant", content: acumulado };
                  return copia;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setPensando(false);
      setMensajes((prev) => [...prev, { role: "assistant", content: "No he podido responder. Inténtalo otra vez." }]);
    }
  }, [mensajes, pensando, etapa, usuario]);

  return (
    <>
      {/* ── Botón flotante ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 18 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setAbierto(true)}
        aria-label="Abrir asistente"
        style={{
          position: "fixed",
          right: 16,
          bottom: `calc(20px + env(safe-area-inset-bottom))`,
          width: 78, height: 78, borderRadius: "50%",
          border: `3px solid ${BCN.sol}`,
          background: "#0A1A3C",
          cursor: "pointer", padding: 0, overflow: "hidden",
          boxShadow: "0 8px 26px rgba(10,26,60,0.5)",
          zIndex: 80,
        }}
      >
        <Avatar hayFoto={hayFoto} />

        {/* Pulso para que se note que está ahí */}
        <motion.span
          animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          style={{
            position: "absolute", inset: -2, borderRadius: "50%",
            border: `2px solid ${BCN.sol}`, pointerEvents: "none",
          }}
        />
      </motion.button>

      {/* ── El asistente abierto ── */}
      <AnimatePresence>
        {abierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setAbierto(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 200,
                background: "rgba(20,16,14,0.62)", backdropFilter: "blur(3px)",
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "fixed", zIndex: 201,
                left: 12, right: 12,
                top: `calc(56px + env(safe-area-inset-top))`,
                bottom: `calc(14px + env(safe-area-inset-bottom))`,
                background: BCN.arena, borderRadius: 24,
                display: "flex", flexDirection: "column", overflow: "hidden",
                boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
                maxWidth: 620, marginInline: "auto",
              }}
            >
              {/* Cabecera */}
              <div style={{
                background: `linear-gradient(135deg, #0A1A3C 0%, #8B1538 100%)`,
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
              }}>
                <button
                  onClick={() => hayFoto && setAmpliada(true)}
                  aria-label="Ver la foto"
                  style={{
                    width: 46, height: 46, borderRadius: "50%", overflow: "hidden",
                    border: `2px solid ${BCN.sol}`, flexShrink: 0, background: "#0A1A3C",
                    position: "relative", padding: 0,
                    cursor: hayFoto ? "pointer" : "default",
                  }}>
                  <Avatar hayFoto={hayFoto} />
                </button>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 15.5, fontWeight: 700, color: "white", margin: 0 }}>
                    Olmo
                  </p>
                  <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", margin: "1px 0 0" }}>
                    Vuestro guía en Barcelona
                  </p>
                </div>

                <button onClick={() => setAbierto(false)} aria-label="Cerrar"
                  style={{
                    marginLeft: "auto", width: 34, height: 34, borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Conversación */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", WebkitOverflowScrolling: "touch" }}>
                {mensajes.length === 0 ? (
                  <div style={{ paddingTop: 4 }}>
                    {hayFoto && (
                      <motion.img
                        src="/asistente-completo.png" alt="Ver la foto completa"
                        onClick={() => setAmpliada(true)}
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ duration: 0.45 }}
                        style={{
                          display: "block", width: "62%", maxWidth: 210, margin: "0 auto 10px",
                          filter: "drop-shadow(0 10px 22px rgba(10,26,60,0.28))",
                          cursor: "pointer",
                        }}
                      />
                    )}
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 21, color: BCN.tinta, margin: "0 0 6px", textAlign: "center" }}>
                      Soy Olmo
                    </p>
                    <p style={{ fontSize: 14, color: BCN.humo, margin: "0 0 18px", lineHeight: 1.6, textAlign: "center" }}>
                      ¿Qué buscamos hoy?
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {SUGERENCIAS.map((s, i) => (
                        <motion.button key={s}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                          onClick={() => enviar(s)}
                          style={{
                            width: "100%", textAlign: "left", padding: "12px 15px", borderRadius: 13,
                            background: "white", border: `1px solid ${BCN.arenaOsc}`, cursor: "pointer",
                            fontSize: 14, color: BCN.tinta,
                          }}>
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  mensajes.map((m, i) => <Burbuja key={i} mensaje={m} />)
                )}
                {pensando && <Puntos />}
                <div ref={finRef} />
              </div>

              {/* Entrada */}
              <div style={{ flexShrink: 0, padding: "11px 14px", background: "white", borderTop: `1px solid ${BCN.arenaOsc}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
                    placeholder="Escribe aquí…"
                    rows={1}
                    style={{
                      flex: 1, padding: "11px 14px", borderRadius: 20,
                      border: `1px solid ${BCN.arenaOsc}`, background: BCN.arena,
                      fontSize: 15, color: BCN.tinta, fontFamily: "inherit",
                      outline: "none", resize: "none", maxHeight: 110, lineHeight: 1.4,
                      boxSizing: "border-box",
                    }}
                  />
                  <button onClick={() => enviar(texto)} disabled={!texto.trim() || pensando} aria-label="Enviar"
                    style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0, border: "none",
                      background: texto.trim() && !pensando ? "#8B1538" : BCN.arenaOsc,
                      cursor: texto.trim() && !pensando ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 19V5M5 12l7-7 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── La foto, a pantalla completa ── */}
      <AnimatePresence>
        {ampliada && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAmpliada(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 300,
              background: "rgba(8,6,5,0.93)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <motion.img
              src="/asistente-completo.png" alt=""
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              style={{
                maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                borderRadius: 16,
                filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.6))",
              }}
            />

            <button onClick={() => setAmpliada(false)} aria-label="Cerrar"
              style={{
                position: "fixed", top: `calc(16px + env(safe-area-inset-top))`, right: 16,
                width: 40, height: 40, borderRadius: "50%",
                background: "rgba(255,255,255,0.16)", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(8px)",
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── El avatar ────────────────────────────────────────────── */

function Avatar({ hayFoto }: { hayFoto: boolean }) {
  if (hayFoto) {
    return (
      <img src="/asistente.png" alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    );
  }
  return <Futbolista />;
}

/** Futbolista blaugrana, dibujado a mano. Sustituible por /asistente.png. */
function Futbolista() {
  return (
    <svg viewBox="0 0 60 60" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      <defs>
        <clipPath id="circulo"><circle cx="30" cy="30" r="30" /></clipPath>
      </defs>

      <g clipPath="url(#circulo)">
        {/* Fondo de estadio nocturno */}
        <rect width="60" height="60" fill="#0A1A3C" />
        <circle cx="14" cy="12" r="1.6" fill="#FFF6D0" opacity="0.55" />
        <circle cx="46" cy="10" r="1.6" fill="#FFF6D0" opacity="0.55" />
        <circle cx="30" cy="7"  r="1.3" fill="#FFF6D0" opacity="0.35" />

        {/* Camiseta blaugrana */}
        <path d="M13,60 L13,44 Q13,38 20,35 L40,35 Q47,38 47,44 L47,60 Z" fill="#8B1538" />
        <rect x="18" y="35" width="5" height="25" fill="#0A1A3C" />
        <rect x="28" y="35" width="5" height="25" fill="#0A1A3C" />
        <rect x="38" y="35" width="5" height="25" fill="#0A1A3C" />

        {/* Hombros */}
        <path d="M13,60 L13,44 Q13,38 20,35 L22,37 Q17,40 17,45 L17,60 Z" fill="#6E1029" opacity="0.55" />

        {/* Cuello */}
        <path d="M25,33 L35,33 L34,38 L26,38 Z" fill="#E8B48C" />

        {/* Cabeza */}
        <ellipse cx="30" cy="24" rx="11" ry="12.5" fill="#F2C49B" />

        {/* Pelo rubio */}
        <path d="M19.5,22 Q19,12 30,11.5 Q41,12 40.5,22 Q40,17 36,15.5 Q30,13.8 24,15.5 Q20,17 19.5,22 Z" fill="#E8C86A" />
        <path d="M20,20 Q24,16 30,16 Q36,16 40,20 Q36,18 30,18 Q24,18 20,20 Z" fill="#F0DA96" />

        {/* Cejas */}
        <path d="M24,22.5 L28,21.8" stroke="#6B4A2A" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M32,21.8 L36,22.5" stroke="#6B4A2A" strokeWidth="1.1" strokeLinecap="round" />

        {/* Ojos */}
        <ellipse cx="26" cy="25" rx="1.9" ry="2.2" fill="white" />
        <ellipse cx="34" cy="25" rx="1.9" ry="2.2" fill="white" />
        <circle cx="26.3" cy="25.3" r="1.15" fill="#3A2A1A" />
        <circle cx="34.3" cy="25.3" r="1.15" fill="#3A2A1A" />
        <circle cx="26.7" cy="24.8" r="0.4" fill="white" />
        <circle cx="34.7" cy="24.8" r="0.4" fill="white" />

        {/* Nariz y sonrisa */}
        <path d="M30,26.5 L30,28.8" stroke="#D9A277" strokeWidth="1" strokeLinecap="round" />
        <path d="M26.5,31 Q30,33.4 33.5,31" stroke="#8A5A3A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ─── Piezas del chat ──────────────────────────────────────── */

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const esUsuario = mensaje.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      style={{ display: "flex", justifyContent: esUsuario ? "flex-end" : "flex-start", marginBottom: 10 }}
    >
      <div style={{
        maxWidth: "88%", padding: "11px 15px",
        borderRadius: esUsuario ? "17px 17px 5px 17px" : "17px 17px 17px 5px",
        background: esUsuario ? "#8B1538" : "white",
        color: esUsuario ? "white" : BCN.tinta,
        border: esUsuario ? "none" : `1px solid ${BCN.arenaOsc}`,
        fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {mensaje.content}
      </div>
    </motion.div>
  );
}

function Puntos() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "11px 15px", background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: "17px 17px 17px 5px", width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: BCN.humo }} />
      ))}
    </div>
  );
}
