"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

export interface SignaturePadTheme {
  /** Fondo del bottom-sheet */
  sheetBg?: string;
  /** Color de acento (bordes, botón borrar, títulos) */
  accent?: string;
  /** Color del texto del título */
  titleColor?: string;
  /** Color del trazo de la firma */
  strokeColor?: string;
  /** Gradiente del botón confirmar */
  confirmGradient?: string;
  /** Familia tipográfica del título */
  fontFamily?: string;
  /** Título del sheet */
  title?: string;
  /** Texto guía dentro del canvas */
  hint?: string;
}

const DEFAULTS: Required<SignaturePadTheme> = {
  sheetBg: "#fdf6ec",
  accent: "#8b5a2b",
  titleColor: "#3d2010",
  strokeColor: "#1a0a00",
  confirmGradient: "linear-gradient(135deg, #8b5a2b, #c9a96e)",
  fontFamily: "Georgia, serif",
  title: "✍️ Tu firma",
  hint: "Firma aquí con el dedo",
};

interface SignaturePadProps {
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  saving: boolean;
  theme?: SignaturePadTheme;
}

/**
 * Bottom-sheet con un canvas para firmar con el dedo.
 * El trazo se exporta como PNG con fondo transparente.
 */
export function SignaturePad({ onSave, onCancel, saving, theme }: SignaturePadProps) {
  const t = { ...DEFAULTS, ...theme };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Escala coordenadas CSS → coordenadas internas del canvas
  const getPos = (e: TouchEvent | MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  // Ajusta resolución interna del canvas al tamaño real del wrapper
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = t.strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDraw = useCallback((e: TouchEvent | MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: TouchEvent | MouseEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStrokes(true);
  }, []);

  const stopDraw = useCallback(() => { drawing.current = false; }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;

    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);

    return () => {
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDraw);
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  const clear = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Restaurar estilos tras limpiar
    ctx.strokeStyle = t.strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasStrokes(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.toBlob((blob) => { if (blob) onSave(blob); }, "image/png");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "flex-end" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
        style={{ width: "100%", background: t.sheetBg, borderRadius: "24px 24px 0 0", padding: "24px 20px", paddingBottom: `calc(24px + env(safe-area-inset-bottom))` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: t.fontFamily, fontSize: 17, fontWeight: 700, color: t.titleColor, margin: 0 }}>{t.title}</p>
          <button onClick={onCancel} style={{ background: `${t.accent}1a`, border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 14, color: t.accent }}>✕</button>
        </div>

        <div ref={wrapRef} style={{ background: "white", borderRadius: 16, border: `2px dashed ${t.accent}4d`, overflow: "hidden", marginBottom: 14, position: "relative", height: 160 }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "crosshair" }}
          />
          {!hasStrokes && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <p style={{ fontSize: 13, color: `${t.accent}66`, fontStyle: "italic" }}>{t.hint}</p>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={clear} style={{ flex: 1, padding: "12px", background: `${t.accent}14`, border: `1px solid ${t.accent}33`, borderRadius: 12, fontSize: 13, fontWeight: 600, color: t.accent, cursor: "pointer" }}>
            🗑 Borrar
          </button>
          <button onClick={confirm} disabled={!hasStrokes || saving}
            style={{ flex: 2, padding: "12px", background: hasStrokes && !saving ? t.confirmGradient : "rgba(0,0,0,0.08)", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, color: hasStrokes && !saving ? "white" : "rgba(0,0,0,0.3)", cursor: hasStrokes && !saving ? "pointer" : "default" }}>
            {saving ? "Guardando…" : "Confirmar firma ✓"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
