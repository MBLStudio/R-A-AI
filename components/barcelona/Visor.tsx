"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════
   Ver una foto en grande.

   Se abre a pantalla completa sobre lo que estuvieras mirando.
   Se pasa de una a otra deslizando, se cierra tocando fuera,
   con la flecha del móvil o con Escape.
   ═══════════════════════════════════════════════════════════ */

export function Visor({ fotos, indice, onCerrar }: {
  fotos: string[];
  /** Cuál se abre primero. null = cerrado. */
  indice: number | null;
  onCerrar: () => void;
}) {
  const [actual, setActual] = useState(0);
  const tocado = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (indice !== null) setActual(indice);
  }, [indice]);

  const abierto = indice !== null && fotos.length > 0;

  const ir = useCallback((paso: number) => {
    setActual((n) => (n + paso + fotos.length) % fotos.length);
  }, [fotos.length]);

  // Teclado en el ordenador, y el botón atrás del móvil
  useEffect(() => {
    if (!abierto) return;

    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };

    // Metemos una entrada en el historial: así el gesto de volver
    // cierra la foto en vez de sacarte de la pantalla.
    window.history.pushState({ visor: true }, "");
    const atras = () => onCerrar();

    window.addEventListener("keydown", teclas);
    window.addEventListener("popstate", atras);
    return () => {
      window.removeEventListener("keydown", teclas);
      window.removeEventListener("popstate", atras);
      // Si se cerró de otra forma, deshacemos la entrada que metimos
      if (window.history.state?.visor) window.history.back();
    };
  }, [abierto, ir, onCerrar]);

  // Mientras se mira una foto, el fondo no se mueve
  useEffect(() => {
    if (!abierto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [abierto]);

  const varias = fotos.length > 1;

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onCerrar}
          onTouchStart={(e) => {
            tocado.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            if (!tocado.current) return;
            const dx = e.changedTouches[0].clientX - tocado.current.x;
            const dy = e.changedTouches[0].clientY - tocado.current.y;
            tocado.current = null;
            // Hacia abajo se cierra; a los lados se cambia de foto
            if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) { onCerrar(); return; }
            if (varias && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) ir(dx < 0 ? 1 : -1);
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(12,8,6,0.95)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
            touchAction: "none",
          }}
        >
          <motion.img
            key={fotos[actual]}
            src={fotos[actual]}
            alt=""
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              objectFit: "contain", display: "block",
            }}
          />

          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{
              position: "absolute", top: "calc(14px + env(safe-area-inset-top))", right: 14,
              width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.16)", backdropFilter: "blur(8px)",
              color: "white", fontSize: 19, lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>

          {varias && (
            <>
              <Flecha lado="izq" onClick={() => ir(-1)} />
              <Flecha lado="der" onClick={() => ir(1)} />

              <div style={{
                position: "absolute", bottom: "calc(18px + env(safe-area-inset-bottom))",
                left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6,
              }}>
                {fotos.map((f, i) => (
                  <span key={f} style={{
                    width: i === actual ? 18 : 6, height: 6, borderRadius: 3,
                    background: i === actual ? "white" : "rgba(255,255,255,0.4)",
                    transition: "width .2s",
                  }} />
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Flecha({ lado, onClick }: { lado: "izq" | "der"; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={lado === "izq" ? "Anterior" : "Siguiente"}
      style={{
        position: "absolute", top: "50%", transform: "translateY(-50%)",
        [lado === "izq" ? "left" : "right"]: 10,
        width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "rgba(255,255,255,0.14)", backdropFilter: "blur(8px)",
        color: "white", fontSize: 20, lineHeight: 1, padding: 0,
      }}
    >
      {lado === "izq" ? "‹" : "›"}
    </button>
  );
}

/** Para no repetir el mismo par de estados en cada pantalla. */
export function useVisor() {
  const [abierta, setAbierta] = useState<number | null>(null);
  return {
    indice: abierta,
    abrir: (i: number) => setAbierta(i),
    cerrar: () => setAbierta(null),
  };
}
