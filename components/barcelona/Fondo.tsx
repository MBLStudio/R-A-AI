"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import {
  todosLosFondos, fondoDeHoy, leerAjuste, fijarFondo,
  guardarFondoPropio, borrarFondoPropio,
  type Fondo as TFondo, type AjusteFondo,
} from "@/lib/barcelona/fondos";
import { subirFoto } from "@/lib/upload";
import { Hoja, Boton } from "@/components/barcelona/Shell";

/* ═══════════════════════════════════════════════════════════
   La foto de la cabecera.

   Cambia sola cada día. Si una os gusta mucho, se fija y se
   queda. Y podéis subir las vuestras, ajustando el encuadre.

   Lo que se elija lo ven los dos: se guarda con la etapa, no
   en el móvil de quien lo tocó.
   ═══════════════════════════════════════════════════════════ */

export function Fondo({ etapaId, onGestionar }: { etapaId: string | null; onGestionar: () => void }) {
  const [fondo, setFondo] = useState<TFondo | null>(null);

  useEffect(() => {
    if (!etapaId) return;
    leerAjuste(etapaId).then((a) => setFondo(fondoDeHoy(a)));
  }, [etapaId]);

  if (!fondo) {
    return <div style={{ position: "absolute", inset: 0, background: BCN.tejaOsc }} />;
  }

  return (
    <>
      <motion.div
        key={fondo.url}
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${fondo.url})`,
          backgroundSize: "cover",
          backgroundPosition: fondo.posicion,
        }}
      />
      <button onClick={onGestionar} aria-label="Cambiar la foto"
        style={{
          position: "absolute", right: 12, bottom: 26, zIndex: 3,
          padding: "5px 11px", borderRadius: 16, cursor: "pointer",
          background: "rgba(0,0,0,0.32)", border: "none",
          backdropFilter: "blur(6px)",
          color: "rgba(255,255,255,0.9)", fontSize: 11,
          display: "flex", alignItems: "center", gap: 5,
        }}>
        🖼 Foto
      </button>
    </>
  );
}

/* ─── Gestión de fotos ─────────────────────────────────────── */

export function HojaFondos({ abierta, etapaId, onCerrar, onCambio }: {
  abierta: boolean; etapaId: string | null;
  onCerrar: () => void;
  /** Para que la cabecera se entere de que hay foto nueva. */
  onCambio: () => void;
}) {
  const [ajuste, setAjuste] = useState<AjusteFondo>({ fijado: null, posicionFijada: null, propias: [] });
  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState<{ url: string; y: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refrescar = useCallback(async () => {
    if (!etapaId) return;
    setAjuste(await leerAjuste(etapaId));
  }, [etapaId]);

  useEffect(() => { if (abierta) refrescar(); }, [abierta, refrescar]);

  const fondos = todosLosFondos(ajuste.propias);

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setFallo(null);
    const r = await subirFoto(file, "barcelona-fondos");
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
    if (r.url) setAjustando({ url: r.url, y: 50 });
    else setFallo(r.error ?? "No hemos podido subir la foto.");
  };

  const confirmarAjuste = async () => {
    if (!ajustando || !etapaId) return;
    const nuevo = await guardarFondoPropio(etapaId, ajuste.propias, ajustando.url, `center ${ajustando.y}%`);
    await fijarFondo(etapaId, nuevo.url, nuevo.posicion);
    setAjustando(null);
    await refrescar();
    onCambio();
  };

  const alternarFijado = async (f: TFondo) => {
    if (!etapaId) return;
    const estaFijada = ajuste.fijado === f.url;
    await fijarFondo(etapaId, estaFijada ? null : f.url, estaFijada ? null : f.posicion);
    await refrescar();
    onCambio();
  };

  const quitar = async (f: TFondo) => {
    if (!etapaId) return;
    await borrarFondoPropio(etapaId, ajuste.propias, f.id);
    await refrescar();
    onCambio();
  };

  return (
    <>
      <Hoja abierta={abierta && !ajustando} onCerrar={onCerrar} titulo="La foto de la cabecera">
        <p style={{ fontSize: 13.5, color: BCN.humo, margin: "-10px 0 18px", lineHeight: 1.6 }}>
          {ajuste.fijado
            ? "Tenéis una foto fijada. Quitad el pin para que vuelvan a rotar solas."
            : "Cambian solas cada día. Pulsad el pin de una para que se quede fija."}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {fondos.map((f) => {
            const activo = ajuste.fijado === f.url;
            return (
              <div key={f.id} style={{ position: "relative" }}>
                <button onClick={() => alternarFijado(f)}
                  style={{
                    width: "100%", aspectRatio: "4/3", borderRadius: 13, overflow: "hidden",
                    border: activo ? `2.5px solid ${BCN.sol}` : `1px solid ${BCN.arenaOsc}`,
                    padding: 0, cursor: "pointer", position: "relative", display: "block",
                    backgroundImage: `url(${f.url})`,
                    backgroundSize: "cover",
                    backgroundPosition: f.posicion,
                  }}>
                  <span style={{
                    position: "absolute", top: 6, right: 6,
                    width: 26, height: 26, borderRadius: "50%",
                    background: activo ? BCN.sol : "rgba(0,0,0,0.42)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, backdropFilter: "blur(4px)",
                  }}>
                    {activo ? "📌" : "○"}
                  </span>

                  <span style={{
                    position: "absolute", left: 0, right: 0, bottom: 0,
                    padding: "16px 8px 6px",
                    background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.7))",
                    color: "white", fontSize: 10, lineHeight: 1.3, textAlign: "left",
                    display: "block",
                  }}>
                    {f.titulo}
                  </span>
                </button>

                {f.propia && (
                  <button onClick={() => quitar(f)} aria-label="Borrar foto"
                    style={{
                      position: "absolute", top: 6, left: 6, width: 24, height: 24,
                      borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none",
                      color: "white", fontSize: 13, cursor: "pointer", lineHeight: 1, padding: 0,
                    }}>
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={() => fileRef.current?.click()} disabled={subiendo}
          style={{
            width: "100%", marginTop: 12, padding: "14px", borderRadius: 13,
            border: `1.5px dashed ${BCN.arenaOsc}`, background: "transparent",
            color: BCN.humo, fontSize: 14, cursor: "pointer",
          }}>
          {subiendo ? "Subiendo…" : "＋ Añadir una foto vuestra"}
        </button>

        {fallo && (
          <p style={{ fontSize: 12.5, color: BCN.teja, margin: "8px 0 0", lineHeight: 1.5 }}>{fallo}</p>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={subir}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />

        <p style={{ fontSize: 11, color: BCN.humo, margin: "14px 0 0", textAlign: "center", lineHeight: 1.55, opacity: 0.75 }}>
          Lo que elijáis lo veis los dos. Las de serie son de Wikimedia Commons (CC BY-SA).
        </p>
      </Hoja>

      {/* Ajuste del encuadre */}
      <Hoja abierta={!!ajustando} onCerrar={() => setAjustando(null)} titulo="Ajustad el encuadre">
        {ajustando && (
          <>
            <p style={{ fontSize: 13.5, color: BCN.humo, margin: "-10px 0 16px", lineHeight: 1.6 }}>
              Moved la barra hasta que se vea lo que queréis. Así se verá en la cabecera.
            </p>

            <div style={{
              width: "100%", height: 190, borderRadius: 15, overflow: "hidden",
              border: `1px solid ${BCN.arenaOsc}`, position: "relative",
              backgroundImage: `url(${ajustando.url})`,
              backgroundSize: "cover",
              backgroundPosition: `center ${ajustando.y}%`,
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, rgba(90,36,24,0.45) 0%, rgba(90,36,24,0.1) 45%, rgba(90,36,24,0.4) 100%)",
                display: "flex", alignItems: "flex-end", padding: 16,
              }}>
                <span style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
                  Catalanes por una temporada
                </span>
              </div>
            </div>

            <div style={{ marginTop: 18, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11.5, color: BCN.humo }}>Arriba</span>
                <span style={{ fontSize: 11.5, color: BCN.humo }}>Abajo</span>
              </div>
              <input type="range" min={0} max={100} value={ajustando.y}
                onChange={(e) => setAjustando({ ...ajustando, y: Number(e.target.value) })}
                style={{ width: "100%", accentColor: BCN.teja, height: 26 }} />
            </div>

            <Boton onClick={confirmarAjuste} color={BCN.teja}>
              Usar esta foto
            </Boton>
          </>
        )}
      </Hoja>
    </>
  );
}
