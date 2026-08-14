"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { urlEsVideo } from "@/lib/upload";

/* ═══════════════════════════════════════════════════════════
   Ver una foto en grande.

   Se abre a pantalla completa. Se hace zoom pellizcando o con
   dos toques, se arrastra cuando está ampliada, se pasa de una
   a otra deslizando y se cierra tirando hacia abajo.

   Mientras hay zoom, deslizar mueve la foto en vez de cambiarla:
   si no, sería imposible mirar una esquina sin salirse.
   ═══════════════════════════════════════════════════════════ */

const ZOOM_MAX = 5;
const ZOOM_DOBLE_TOQUE = 2.6;

interface Gesto {
  modo: "nada" | "pellizco" | "mover" | "deslizar";
  /** Dónde empezó: el dedo, o el punto medio entre los dos. */
  x: number;
  y: number;
  distancia: number;
  escalaInicial: number;
  posInicial: { x: number; y: number };
}

export function Visor({ fotos, indice, onCerrar }: {
  fotos: string[];
  /** Cuál se abre primero. null = cerrado. */
  indice: number | null;
  onCerrar: () => void;
}) {
  const [actual, setActual] = useState(0);
  const [escala, setEscala] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const gesto = useRef<Gesto | null>(null);
  const ultimoToque = useRef(0);
  const marco = useRef<HTMLDivElement>(null);
  const imagen = useRef<HTMLImageElement>(null);

  const abierto = indice !== null && fotos.length > 0;
  const varias = fotos.length > 1;
  const esVideoActual = !!fotos[actual] && urlEsVideo(fotos[actual]);
  // Un vídeo no se amplía: se ve y ya
  const ampliada = !esVideoActual && escala > 1.02;

  const reiniciarZoom = useCallback(() => {
    setEscala(1);
    setPos({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (indice !== null) { setActual(indice); reiniciarZoom(); }
  }, [indice, reiniciarZoom]);

  const ir = useCallback((paso: number) => {
    reiniciarZoom();
    setActual((n) => (n + paso + fotos.length) % fotos.length);
  }, [fotos.length, reiniciarZoom]);

  /** El centro del marco en coordenadas de la pantalla. */
  const centroPantalla = useCallback(() => {
    const caja = marco.current?.getBoundingClientRect();
    if (!caja) return { x: 0, y: 0 };
    return { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 };
  }, []);

  /**
   * Que la foto no se pueda arrastrar hasta perderla de vista.
   *
   * Se mide sobre la foto de verdad, no sobre el marco: con
   * `objectFit: contain` casi nunca ocupa todo el hueco, y usar el
   * marco dejaba arrastrarla mucho más allá del borde.
   */
  const limitar = useCallback((p: { x: number; y: number }, e: number) => {
    const img = imagen.current;
    const caja = marco.current?.getBoundingClientRect();
    if (!img || !caja) return p;

    const margenX = Math.max(0, (img.clientWidth * e - caja.width) / 2);
    const margenY = Math.max(0, (img.clientHeight * e - caja.height) / 2);
    return {
      x: Math.max(-margenX, Math.min(margenX, p.x)),
      y: Math.max(-margenY, Math.min(margenY, p.y)),
    };
  }, []);

  /**
   * Acercar hacia un punto concreto, no hacia el medio.
   *
   * Es lo que hace que el zoom se sienta como en el móvil: lo que
   * tienes bajo los dedos se queda donde está y crece alrededor.
   * Sin esto, la foto se va siempre hacia el centro y para mirar
   * una esquina hay que perseguirla arrastrando.
   */
  const acercarHacia = useCallback((
    punto: { x: number; y: number },
    nuevaEscala: number,
    desde: { escala: number; pos: { x: number; y: number } },
  ) => {
    const c = centroPantalla();
    const d = { x: punto.x - c.x, y: punto.y - c.y };
    return {
      x: d.x - (d.x - desde.pos.x) * (nuevaEscala / desde.escala),
      y: d.y - (d.y - desde.pos.y) * (nuevaEscala / desde.escala),
    };
  }, [centroPantalla]);

  /* ─── Gestos ─────────────────────────────────────────────── */

  const alTocar = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      gesto.current = {
        modo: "pellizco",
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
        distancia: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        escalaInicial: escala,
        posInicial: pos,
      };
      return;
    }

    if (e.touches.length === 1) {
      // Dos toques seguidos: acercar o volver
      const ahora = Date.now();
      if (ahora - ultimoToque.current < 280) {
        ultimoToque.current = 0;
        if (ampliada) {
          reiniciarZoom();
        } else {
          // Se acerca a lo que has tocado, no al medio de la foto
          const punto = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          const destino = acercarHacia(punto, ZOOM_DOBLE_TOQUE, { escala, pos });
          setEscala(ZOOM_DOBLE_TOQUE);
          setPos(limitar(destino, ZOOM_DOBLE_TOQUE));
        }
        gesto.current = null;
        return;
      }
      ultimoToque.current = ahora;

      gesto.current = {
        modo: ampliada ? "mover" : "deslizar",
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        distancia: 0,
        escalaInicial: escala,
        posInicial: pos,
      };
    }
  };

  const alMover = (e: React.TouchEvent) => {
    const g = gesto.current;
    if (!g) return;

    if (g.modo === "pellizco" && e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const separacion = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const nueva = Math.max(1, Math.min(ZOOM_MAX, g.escalaInicial * (separacion / g.distancia)));

      // El punto de la foto que había bajo los dedos al empezar sigue
      // bajo los dedos ahora, aunque la mano se haya desplazado. Así se
      // puede acercar y mover a la vez, de una sola pasada.
      const c = centroPantalla();
      const medio = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      const dInicio = { x: g.x - c.x, y: g.y - c.y };
      const dAhora = { x: medio.x - c.x, y: medio.y - c.y };
      const factor = nueva / g.escalaInicial;

      setEscala(nueva);
      setPos(limitar({
        x: dAhora.x - (dInicio.x - g.posInicial.x) * factor,
        y: dAhora.y - (dInicio.y - g.posInicial.y) * factor,
      }, nueva));
      return;
    }

    if (g.modo === "mover" && e.touches.length === 1) {
      const nueva = {
        x: g.posInicial.x + (e.touches[0].clientX - g.x),
        y: g.posInicial.y + (e.touches[0].clientY - g.y),
      };
      setPos(limitar(nueva, escala));
    }
  };

  const alSoltar = (e: React.TouchEvent) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;

    if (g.modo === "pellizco") {
      // Al aflojar del todo, la foto vuelve sola a su sitio
      if (escala < 1.05) reiniciarZoom();
      return;
    }

    if (g.modo !== "deslizar") return;

    const t = e.changedTouches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;

    if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) { onCerrar(); return; }
    if (varias && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) ir(dx < 0 ? 1 : -1);
  };

  /* ─── Teclado y botón atrás ──────────────────────────────── */

  useEffect(() => {
    if (!abierto) return;

    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (ampliada) reiniciarZoom(); else onCerrar(); }
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
      if (e.key === "+" || e.key === "=") setEscala((s) => Math.min(ZOOM_MAX, s * 1.35));
      if (e.key === "-") {
        setEscala((s) => {
          const nueva = Math.max(1, s / 1.35);
          if (nueva <= 1.02) setPos({ x: 0, y: 0 });
          return nueva;
        });
      }
    };

    // Una entrada en el historial: así el gesto de volver cierra la
    // foto en vez de sacarte de la pantalla que estabas mirando.
    window.history.pushState({ visor: true }, "");
    const atras = () => onCerrar();

    window.addEventListener("keydown", teclas);
    window.addEventListener("popstate", atras);
    return () => {
      window.removeEventListener("keydown", teclas);
      window.removeEventListener("popstate", atras);
      if (window.history.state?.visor) window.history.back();
    };
  }, [abierto, ir, onCerrar, ampliada, reiniciarZoom]);

  // Mientras se mira una foto, el fondo no se mueve
  useEffect(() => {
    if (!abierto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, [abierto]);

  /** Rueda del ratón, para el ordenador. */
  const alaRueda = (e: React.WheelEvent) => {
    e.stopPropagation();
    const nueva = Math.max(1, Math.min(ZOOM_MAX, escala * (e.deltaY < 0 ? 1.14 : 0.88)));
    if (nueva <= 1.02) { reiniciarZoom(); return; }
    // Hacia donde apunta el ratón, como en cualquier mapa
    const destino = acercarHacia({ x: e.clientX, y: e.clientY }, nueva, { escala, pos });
    setEscala(nueva);
    setPos(limitar(destino, nueva));
  };

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => { if (!ampliada) onCerrar(); }}
          // Con un vídeo delante, los gestos se los queda el reproductor:
          // si le robamos el toque, no se puede ni mover la barra.
          onTouchStart={esVideoActual ? undefined : alTocar}
          onTouchMove={esVideoActual ? undefined : alMover}
          onTouchEnd={esVideoActual ? undefined : alSoltar}
          onWheel={esVideoActual ? undefined : alaRueda}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(12,8,6,0.96)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
            touchAction: esVideoActual ? "auto" : "none", overflow: "hidden",
          }}
        >
          <div
            ref={marco}
            style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {esVideoActual ? (
              // Sin autoplay a propósito: en el iPhone un vídeo que
              // arranca solo tiene que ir mudo, y aquí el sonido es
              // media gracia. Se pulsa play y se oye.
              <motion.video
                key={fotos[actual]}
                src={fotos[actual]}
                controls
                playsInline
                preload="metadata"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "100%", maxHeight: "100%",
                  display: "block", outline: "none", borderRadius: 6,
                }}
              />
            ) : (
            <motion.img
              ref={imagen}
              key={fotos[actual]}
              src={fotos[actual]}
              alt=""
              draggable={false}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (ampliada) { reiniciarZoom(); return; }
                const destino = acercarHacia({ x: e.clientX, y: e.clientY }, ZOOM_DOBLE_TOQUE, { escala, pos });
                setEscala(ZOOM_DOBLE_TOQUE);
                setPos(limitar(destino, ZOOM_DOBLE_TOQUE));
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "100%", maxHeight: "100%",
                objectFit: "contain", display: "block",
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${escala})`,
                // Sin transición mientras se pellizca: si no, va a tirones
                transition: gesto.current ? "none" : "transform .22s ease-out",
                cursor: ampliada ? "grab" : "zoom-in",
                willChange: "transform",
              }}
            />
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onCerrar(); }}
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

          {ampliada && (
            <button
              onClick={(e) => { e.stopPropagation(); reiniciarZoom(); }}
              style={{
                position: "absolute", top: "calc(14px + env(safe-area-inset-top))", left: 14,
                padding: "8px 14px", borderRadius: 19, border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.16)", backdropFilter: "blur(8px)",
                color: "white", fontSize: 12.5, fontWeight: 600,
              }}
            >
              {escala.toFixed(1)}× · ajustar
            </button>
          )}

          {varias && !ampliada && (
            <>
              <Flecha lado="izq" onClick={() => ir(-1)} />
              <Flecha lado="der" onClick={() => ir(1)} />

              <div style={{
                position: "absolute", bottom: "calc(18px + env(safe-area-inset-bottom))",
                left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6,
                pointerEvents: "none",
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
