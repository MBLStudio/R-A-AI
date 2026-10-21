"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import {
  TIPO_DIA, diaCorto, numeroDia, minutosTurno, textoHoras, totalVentas, euros,
  horaMadrid, leerPrecio, guardarVenta,
  type Persona, type Turno, type Venta,
} from "@/lib/barcelona/trabajo";
import { estiloInput } from "./Shell";

/* ═══════════════════════════════════════════════════════════
   Un día de la semana. Cerrado es una línea: el horario y,
   discreto, lo vendido. Al tocarlo se despliega ahí mismo con
   las ventas del día y un hueco para apuntar la siguiente.
   ═══════════════════════════════════════════════════════════ */

export function DiaTrabajo({ fecha, persona, turno, ventas, esHoy, abierto, cargando, conVentas, ultima, onAlternar, onEditarHorario, onEditarVenta, onCambio }: {
  fecha: string;
  persona: Persona;
  turno: Turno | null;
  ventas: Venta[];
  esHoy: boolean;
  abierto: boolean;
  cargando: boolean;
  conVentas: boolean;
  ultima: boolean;
  onAlternar: () => void;
  onEditarHorario: () => void;
  onEditarVenta: (v: Venta) => void;
  onCambio: () => void;
}) {
  const cfg = turno && !cargando ? TIPO_DIA[turno.tipo] : null;
  const minutos = cargando ? 0 : minutosTurno(turno);
  const libreOVacaciones = cfg && turno?.tipo !== "trabajo";
  const total = totalVentas(ventas);

  return (
    <div style={{
      background: esHoy ? `${BCN.teja}0B` : libreOVacaciones ? `${cfg.color}0C` : "white",
      borderBottom: ultima ? "none" : `1px solid ${BCN.arena}`,
      borderLeft: `3px solid ${cfg ? cfg.color : "transparent"}`,
    }}>
      {/* La línea del día */}
      <motion.button
        whileTap={{ backgroundColor: "rgba(44,36,32,0.04)" }}
        onClick={onAlternar}
        aria-expanded={abierto}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px 12px 11px", minHeight: 64, cursor: "pointer", textAlign: "left",
          background: "transparent", border: "none",
        }}
      >
        <div style={{ width: 36, flexShrink: 0, textAlign: "center" }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: esHoy ? BCN.teja : BCN.humo, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            {diaCorto(fecha)}
          </p>
          <p style={{
            fontFamily: "Georgia, serif", fontSize: esHoy ? 15 : 19, lineHeight: 1, margin: "3px auto 0",
            ...(esHoy
              ? { width: 27, height: 27, borderRadius: "50%", background: BCN.teja, color: "white", display: "flex", alignItems: "center", justifyContent: "center" }
              : { color: BCN.tinta }),
          }}>
            {numeroDia(fecha)}
          </p>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {cargando ? (
            <div style={{ height: 12, width: "55%", borderRadius: 6, background: BCN.arenaOsc, opacity: 0.6 }} />
          ) : turno?.tipo === "trabajo" ? (
            <p style={{ fontSize: 15.5, fontWeight: 600, color: BCN.tinta, margin: 0, fontVariantNumeric: "tabular-nums", display: "flex", flexWrap: "wrap", columnGap: 8 }}>
              {turno.tramos.map((t) => (
                <span key={t.inicio} style={{ whiteSpace: "nowrap" }}>{t.inicio}–{t.fin}</span>
              ))}
            </p>
          ) : cfg ? (
            <span style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
          ) : (
            <p style={{ fontSize: 14, color: BCN.humo, opacity: 0.7, margin: 0 }}>Sin apuntar</p>
          )}
          {!cargando && turno?.nota && (
            <p style={{ fontSize: 12.5, color: BCN.humo, fontStyle: "italic", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: abierto ? "normal" : "nowrap" }}>
              {turno.nota}
            </p>
          )}
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {minutos > 0 && (
            <p style={{ fontSize: 13, color: BCN.humo, margin: 0, fontVariantNumeric: "tabular-nums" }}>{textoHoras(minutos)}</p>
          )}
          {conVentas && !cargando && ventas.length > 0 && (
            <p style={{ fontSize: 11.5, color: BCN.oliva, fontWeight: 600, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {euros(total)}
            </p>
          )}
        </div>

        <motion.svg animate={{ rotate: abierto ? 90 : 0 }} transition={{ duration: 0.2 }}
          width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" stroke={BCN.arenaOsc} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </motion.button>

      {/* Desplegado: horario y ventas del día */}
      <AnimatePresence initial={false}>
        {abierto && !cargando && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 14px 59px" }}>
              <button onClick={onEditarHorario}
                style={{
                  padding: "6px 12px", borderRadius: 16, cursor: "pointer",
                  border: `1px solid ${BCN.mar}40`, background: "white",
                  color: BCN.mar, fontSize: 12.5, fontWeight: 600,
                }}>
                {turno ? "✎ Editar horario" : "+ Apuntar horario"}
              </button>

              {conVentas && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
                      Ventas
                    </p>
                    {ventas.length > 0 && (
                      <p style={{ fontSize: 12.5, color: BCN.tinta, margin: 0 }}>
                        {ventas.length} · <strong style={{ fontWeight: 700 }}>{euros(total)}</strong>
                      </p>
                    )}
                  </div>

                  {ventas.length === 0 ? (
                    <p style={{ fontSize: 13, color: BCN.humo, margin: "0 0 10px" }}>
                      {esHoy ? "Aún no hay ventas hoy, ¡a por ello! ✨" : "Sin ventas este día."}
                    </p>
                  ) : (
                    <div style={{ marginBottom: 10, borderRadius: 12, overflow: "hidden", border: `1px solid ${BCN.arenaOsc}` }}>
                      <AnimatePresence initial={false}>
                        {ventas.map((v, i) => (
                          <motion.button
                            key={v.id}
                            initial={{ opacity: 0, backgroundColor: `${BCN.oliva}22` }}
                            animate={{ opacity: 1, backgroundColor: "#FFFFFF" }}
                            transition={{ duration: 0.6 }}
                            onClick={() => onEditarVenta(v)}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                              border: "none", cursor: "pointer", textAlign: "left",
                              borderBottom: i === ventas.length - 1 ? "none" : `1px solid ${BCN.arena}`,
                            }}>
                            <span style={{ fontSize: 12, color: BCN.humo, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{v.hora}</span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: "block", fontSize: 14, color: BCN.tinta, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {v.nombre}
                              </span>
                              {v.nota && (
                                <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {v.nota}
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: BCN.tinta, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                              {euros(v.precio)}
                            </span>
                          </motion.button>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  <VentaRapida fecha={fecha} persona={persona} onGuardada={onCambio} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Apuntar una venta sin salir del día ──────────────────── */

function VentaRapida({ fecha, persona, onGuardada }: {
  fecha: string; persona: Persona; onGuardada: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  // Vacía = la hora de ahora al guardar. Solo se toca si hay que corregirla.
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [conNota, setConNota] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refPrecio = useRef<HTMLInputElement>(null);
  // Candado síncrono: un doble toque no apunta la venta dos veces
  const enviando = useRef(false);

  const importe = leerPrecio(precio);
  const valida = nombre.trim().length > 0 && importe !== null;

  const guardar = async () => {
    if (!valida || importe === null || enviando.current) return;
    enviando.current = true;
    setGuardando(true);
    setError(null);
    const ok = await guardarVenta(persona, { fecha, hora: hora || horaMadrid(), nombre, precio: importe, nota });
    enviando.current = false;
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar. Prueba otra vez."); return; }
    setNombre(""); setPrecio(""); setHora(""); setNota(""); setConNota(false);
    // Fuera teclado: que se vea la venta recién apuntada
    (document.activeElement as HTMLElement | null)?.blur();
    onGuardada();
  };

  const campo: React.CSSProperties = { ...estiloInput, padding: "10px 12px", fontSize: 15 };

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar(); }}
      style={{ background: "white", borderRadius: 14, border: `1.5px dashed ${BCN.teja}55`, padding: 10 }}>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)}
        placeholder="+ Añadir venta: ¿qué has vendido?"
        enterKeyHint="next"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); refPrecio.current?.focus(); } }}
        style={{ ...campo, border: "none", padding: "6px 4px", fontSize: 14.5 }} />

      {/* El resto aparece en cuanto se empieza a escribir */}
      <AnimatePresence initial={false}>
        {(nombre || precio) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <input ref={refPrecio} value={precio} onChange={(e) => setPrecio(e.target.value)}
                  inputMode="decimal" enterKeyHint="done" placeholder="0,00" aria-label="Precio"
                  style={{ ...campo, fontWeight: 700, paddingRight: 26, fontVariantNumeric: "tabular-nums" }} />
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: BCN.humo, fontSize: 14 }}>€</span>
              </div>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora"
                style={{ ...campo, width: 92, flexShrink: 0, padding: "10px 8px", fontVariantNumeric: "tabular-nums", color: hora ? BCN.tinta : BCN.humo }} />
              <button type="submit" disabled={!valida || guardando}
                style={{
                  flexShrink: 0, padding: "0 14px", borderRadius: 12, border: "none",
                  background: valida ? BCN.teja : BCN.arenaOsc, color: valida ? "white" : BCN.humo,
                  fontSize: 14, fontWeight: 700, cursor: valida ? "pointer" : "default", transition: "background 0.15s",
                }}>
                {guardando ? "…" : "Guardar"}
              </button>
            </div>

            {conNota ? (
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)"
                style={{ ...campo, marginTop: 6, fontSize: 14 }} />
            ) : (
              <button type="button" onClick={() => setConNota(true)}
                style={{ marginTop: 6, padding: "2px 2px", background: "none", border: "none", color: BCN.humo, fontSize: 12.5, cursor: "pointer" }}>
                + nota
              </button>
            )}

            {(error || (precio && importe === null)) && (
              <p style={{ fontSize: 12.5, color: BCN.teja, margin: "6px 0 0" }}>
                {error ?? "Ese precio no se entiende. Ejemplo: 129,90"}
              </p>
            )}
            {!hora && (
              <p style={{ fontSize: 11.5, color: BCN.humo, margin: "4px 0 0" }}>La hora se pone sola al guardar.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
