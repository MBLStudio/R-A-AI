"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";

/* ═══════════════════════════════════════════════════════════
   Piezas compartidas de Proyecto Barcelona
   ═══════════════════════════════════════════════════════════ */

/** Pantalla base: fondo arena, cabecera con degradado y contenido centrado. */
export function Pantalla({
  titulo, subtitulo, color = BCN.teja, accion, children,
}: {
  titulo: string;
  subtitulo?: string;
  color?: string;
  accion?: { icon: ReactNode; onClick: () => void; label: string };
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    /* El <main> del layout tiene overflow:hidden, así que cada pantalla
       gestiona su propio scroll. Cabecera fija + cuerpo desplazable. */
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BCN.arena, overflow: "hidden" }}>
      <div style={{
        background: `linear-gradient(150deg, ${color} 0%, ${sombra(color)} 100%)`,
        padding: "14px 18px 20px",
        paddingTop: `calc(14px + env(safe-area-inset-top))`,
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 680, margin: "0 auto" }}>
          <button onClick={() => router.back()} aria-label="Volver"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 21, fontWeight: 400, color: "white", margin: 0, lineHeight: 1.2 }}>
              {titulo}
            </h1>
            {subtitulo && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", margin: "2px 0 0" }}>{subtitulo}</p>
            )}
          </div>
          {accion && (
            <button onClick={accion.onClick} aria-label={accion.label}
              style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.22)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {accion.icon}
            </button>
          )}
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch",
        padding: "18px 16px", paddingBottom: `calc(48px + env(safe-area-inset-bottom))`,
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}

/** Oscurece un hex para el degradado de la cabecera. */
function sombra(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = 0.72;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

/** Icono "+" para la acción de la cabecera. */
export const IconoMas = (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

/** Tarjeta de papel: el contenedor por defecto de todo. */
export function Tarjeta({ children, onClick, style }: {
  children: ReactNode; onClick?: () => void; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 16,
    padding: "15px 17px", boxShadow: "0 2px 10px rgba(44,36,32,0.04)",
    width: "100%", textAlign: "left", ...style,
  };
  if (!onClick) return <div style={base}>{children}</div>;
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} style={{ ...base, cursor: "pointer" }}>
      {children}
    </motion.button>
  );
}

/** Estado vacío con invitación a empezar. */
export function Vacio({ icon, titulo, texto, accion }: {
  icon: string; titulo: string; texto: string; accion?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px" }}>
      <p style={{ fontSize: 42, margin: 0, opacity: 0.85 }}>{icon}</p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 19, color: BCN.tinta, margin: "14px 0 7px" }}>{titulo}</p>
      <p style={{ fontSize: 14, color: BCN.humo, margin: 0, lineHeight: 1.6, maxWidth: 300, marginInline: "auto" }}>{texto}</p>
      {accion && (
        <button onClick={accion.onClick}
          style={{ marginTop: 20, padding: "11px 22px", borderRadius: 24, background: BCN.tinta, color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {accion.label}
        </button>
      )}
    </div>
  );
}

/** Hoja inferior para formularios. */
export function Hoja({ abierta, onCerrar, titulo, children }: {
  abierta: boolean; onCerrar: () => void; titulo: string; children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCerrar}
            style={{ position: "fixed", inset: 0, background: "rgba(44,36,32,0.45)", zIndex: 100, backdropFilter: "blur(2px)" }}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
              background: BCN.arena, borderRadius: "24px 24px 0 0",
              padding: "10px 20px 24px", paddingBottom: `calc(24px + env(safe-area-inset-bottom))`,
              maxHeight: "92dvh", overflowY: "auto",
              maxWidth: 680, margin: "0 auto",
            }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 2, background: BCN.arenaOsc, margin: "0 auto 16px" }} />
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 400, color: BCN.tinta, margin: "0 0 18px" }}>
              {titulo}
            </h2>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Campo de formulario etiquetado. */
export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export const estiloInput: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  border: `1px solid ${BCN.arenaOsc}`, background: "white",
  fontSize: 15, color: BCN.tinta, fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};

/** Botón principal de acción. */
export function Boton({ children, onClick, disabled, color = BCN.tinta }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; color?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", padding: "14px", borderRadius: 14, border: "none",
        background: disabled ? BCN.arenaOsc : color,
        color: disabled ? BCN.humo : "white",
        fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        marginTop: 6, transition: "background 0.15s",
      }}>
      {children}
    </button>
  );
}

/** Selector horizontal de opciones. */
export function Selector<T extends string>({ valor, opciones, onChange, color = BCN.teja }: {
  valor: T;
  opciones: { valor: T; label: string; icon?: string }[];
  onChange: (v: T) => void;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button key={o.valor} onClick={() => onChange(o.valor)}
            style={{
              flexShrink: 0, padding: "9px 14px", borderRadius: 20,
              border: `1px solid ${activo ? color : BCN.arenaOsc}`,
              background: activo ? color : "white",
              color: activo ? "white" : BCN.tinta,
              fontSize: 13, fontWeight: activo ? 700 : 500, cursor: "pointer",
              whiteSpace: "nowrap", transition: "all 0.15s",
            }}>
            {o.icon ? `${o.icon} ` : ""}{o.label}
          </button>
        );
      })}
    </div>
  );
}
