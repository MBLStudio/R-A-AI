"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, type Etapa } from "@/lib/barcelona/types";
import { getEtapaActiva } from "@/lib/barcelona/queries";

interface Mensaje { role: "user" | "assistant"; content: string }

const SUGERENCIAS = [
  "¿Cómo vamos?",
  "¿Qué barrio nos encaja más?",
  "¿Qué tenemos pendiente?",
  "¿Qué recomendarías hacer mañana?",
  "Resume nuestra semana",
  "¿Cómo han cambiado nuestras opiniones?",
  "¿Qué piso tiene más potencial?",
];

export default function CopilotoPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);
  useEffect(() => { getEtapaActiva().then(setEtapa); }, []);
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes, pensando]);

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
        body: JSON.stringify({ messages: nuevos, etapaId: etapa.id, usuario: user }),
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
  }, [mensajes, pensando, etapa, user]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BCN.arena, overflow: "hidden" }}>

      {/* Cabecera */}
      <div style={{
        background: `linear-gradient(150deg, ${BCN.noche} 0%, ${BCN.mar} 100%)`,
        padding: "14px 18px 16px",
        paddingTop: `calc(14px + env(safe-area-inset-top))`,
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 680, margin: "0 auto" }}>
          <button onClick={() => history.back()} aria-label="Volver"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.16)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 400, color: "white", margin: 0 }}>Copiloto</h1>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.62)", margin: "1px 0 0" }}>
              Conoce todo vuestro Proyecto Barcelona
            </p>
          </div>
          {mensajes.length > 0 && (
            <button onClick={() => setMensajes([])}
              style={{ marginLeft: "auto", padding: "7px 13px", borderRadius: 18, background: "rgba(255,255,255,0.14)", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 12, cursor: "pointer" }}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Conversación */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: 680, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {mensajes.length === 0 ? (
          <Bienvenida onElegir={enviar} />
        ) : (
          mensajes.map((m, i) => <Burbuja key={i} mensaje={m} />)
        )}
        {pensando && <Pensando />}
        <div ref={finRef} />
      </div>

      {/* Entrada */}
      <div style={{
        flexShrink: 0, padding: "12px 16px",
        paddingBottom: `calc(12px + env(safe-area-inset-bottom))`,
        background: "white", borderTop: `1px solid ${BCN.arenaOsc}`,
      }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-end", maxWidth: 680, margin: "0 auto" }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); }
            }}
            placeholder="Preguntadme lo que sea…"
            rows={1}
            style={{
              flex: 1, padding: "12px 15px", borderRadius: 20,
              border: `1px solid ${BCN.arenaOsc}`, background: BCN.arena,
              fontSize: 15, color: BCN.tinta, fontFamily: "inherit",
              outline: "none", resize: "none", maxHeight: 120, lineHeight: 1.4,
              boxSizing: "border-box",
            }}
          />
          <button onClick={() => enviar(texto)} disabled={!texto.trim() || pensando} aria-label="Enviar"
            style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: texto.trim() && !pensando ? BCN.mar : BCN.arenaOsc,
              border: "none", cursor: texto.trim() && !pensando ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s",
            }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Bienvenida({ onElegir }: { onElegir: (t: string) => void }) {
  return (
    <div style={{ paddingTop: 26 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <p style={{ fontSize: 40, margin: 0 }}>✨</p>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 21, color: BCN.tinta, margin: "14px 0 7px" }}>
          Preguntadme lo que sea
        </p>
        <p style={{ fontSize: 14, color: BCN.humo, margin: 0, lineHeight: 1.6, maxWidth: 300, marginInline: "auto" }}>
          Conozco vuestros barrios, momentos, pisos y planes. No tengo que adivinar nada.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SUGERENCIAS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onElegir(s)}
            style={{
              width: "100%", textAlign: "left", padding: "13px 16px", borderRadius: 14,
              background: "white", border: `1px solid ${BCN.arenaOsc}`, cursor: "pointer",
              fontSize: 14.5, color: BCN.tinta,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            }}>
            {s}
            <span style={{ color: BCN.humo, fontSize: 16 }}>›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: Mensaje }) {
  const esUsuario = mensaje.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      style={{ display: "flex", justifyContent: esUsuario ? "flex-end" : "flex-start", marginBottom: 12 }}
    >
      <div style={{
        maxWidth: "86%", padding: "12px 16px",
        borderRadius: esUsuario ? "18px 18px 5px 18px" : "18px 18px 18px 5px",
        background: esUsuario ? BCN.mar : "white",
        color: esUsuario ? "white" : BCN.tinta,
        border: esUsuario ? "none" : `1px solid ${BCN.arenaOsc}`,
        fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
        boxShadow: esUsuario ? `0 2px 10px ${BCN.mar}30` : "0 2px 8px rgba(44,36,32,0.04)",
      }}>
        {mensaje.content}
      </div>
    </motion.div>
  );
}

function Pensando() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: "18px 18px 18px 5px", width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: BCN.humo }} />
      ))}
    </div>
  );
}
