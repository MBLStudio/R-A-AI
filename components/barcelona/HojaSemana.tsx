"use client";

import { useState, useEffect } from "react";
import { BCN } from "@/lib/barcelona/types";
import {
  TIPO_DIA, diasDeSemana, diaCorto, numeroDia, rangoSemana, sumarDias, hoyMadrid,
  getTurnos, guardarSemana, revisarTramos, minutosTurno, textoHoras,
  type Persona, type Turno, type Tramo, type TipoDia, type DatosDia,
} from "@/lib/barcelona/trabajo";
import { Hoja, Boton } from "./Shell";
import { EditorTramos } from "./HojaTurno";

/* ═══════════════════════════════════════════════════════════
   Rellenar la semana de golpe. Los horarios llegan por semanas,
   así que se apuntan los 7 días en una sola pantalla.
   ═══════════════════════════════════════════════════════════ */

/** Un día en el formulario. tipo null = sin apuntar (y si lo estaba, se borra). */
interface DiaForm {
  tipo: TipoDia | null;
  tramos: Tramo[];
  nota: string | null;
}

const VACIO: DiaForm = { tipo: null, tramos: [], nota: null };

function desdeTurno(t: Turno | undefined): DiaForm {
  return t ? { tipo: t.tipo, tramos: t.tramos, nota: t.nota } : VACIO;
}

export function HojaSemana({ abierta, persona, lunes, turnos, onCerrar, onGuardado }: {
  abierta: boolean;
  persona: Persona;
  lunes: string;
  turnos: Turno[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const dias = diasDeSemana(lunes);
  const [form, setForm] = useState<Record<string, DiaForm>>({});
  const [guardando, setGuardando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, parte de lo que ya está guardado esa semana
  useEffect(() => {
    if (!abierta) return;
    setForm(Object.fromEntries(dias.map((f) => [f, desdeTurno(turnos.find((t) => t.fecha === f))])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, lunes]);

  const cambiar = (fecha: string, d: Partial<DiaForm>) =>
    setForm((prev) => ({ ...prev, [fecha]: { ...(prev[fecha] ?? VACIO), ...d } }));

  /** Al marcar "Trabajo", copia los tramos del día de trabajo anterior: casi siempre se repiten. */
  const elegirTipo = (fecha: string, tipo: TipoDia | null) => {
    const actual = form[fecha] ?? VACIO;
    if (tipo !== "trabajo" || actual.tramos.length) return cambiar(fecha, { tipo });
    const anterior = [...dias.slice(0, dias.indexOf(fecha))].reverse()
      .map((f) => form[f]).find((d) => d?.tipo === "trabajo" && !revisarTramos(d.tramos));
    cambiar(fecha, { tipo, tramos: anterior ? anterior.tramos : [{ inicio: "", fin: "" }] });
  };

  const copiarAnterior = async () => {
    setCopiando(true);
    const previos = await getTurnos(persona, sumarDias(lunes, -7), sumarDias(lunes, -1));
    setCopiando(false);
    if (!previos.length) { setError("La semana anterior está vacía."); return; }
    setError(null);
    // Mismo día de la semana, sin las notas: esas son de cada día
    setForm(Object.fromEntries(dias.map((f) => {
      const t = previos.find((p) => p.fecha === sumarDias(f, -7));
      return [f, t ? { tipo: t.tipo, tramos: t.tramos, nota: form[f]?.nota ?? null } : { ...VACIO, nota: form[f]?.nota ?? null }];
    })));
  };

  const problemas = Object.fromEntries(dias.map((f) => {
    const d = form[f];
    return [f, d?.tipo === "trabajo" ? revisarTramos(d.tramos) : null];
  }));
  const hayProblemas = Object.values(problemas).some(Boolean);
  const minutos = dias.reduce((s, f) => {
    const d = form[f];
    return s + (d?.tipo && !problemas[f] ? minutosTurno({ tipo: d.tipo, tramos: d.tramos }) : 0);
  }, 0);

  const guardar = async () => {
    if (hayProblemas) return;
    setGuardando(true);
    setError(null);
    const rellenos = dias
      .filter((f) => form[f]?.tipo)
      .map((f) => ({ fecha: f, datos: form[f] as DatosDia }));
    const borrar = dias.filter((f) => !form[f]?.tipo && turnos.some((t) => t.fecha === f));
    const ok = await guardarSemana(persona, rellenos, borrar);
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar. Prueba otra vez."); return; }
    onGuardado();
    onCerrar();
  };

  const hoy = hoyMadrid();

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={`Semana del ${rangoSemana(lunes)}`}>
      <button onClick={copiarAnterior} disabled={copiando}
        style={{
          width: "100%", padding: "10px", marginBottom: 14, borderRadius: 12, cursor: "pointer",
          border: `1px solid ${BCN.arenaOsc}`, background: "white", color: BCN.mar, fontSize: 13.5, fontWeight: 600,
        }}>
        {copiando ? "Copiando…" : "↺ Copiar la semana anterior"}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dias.map((f) => {
          const d = form[f] ?? VACIO;
          const esHoy = f === hoy;
          return (
            <div key={f} style={{
              background: "white", borderRadius: 14, padding: "10px 12px",
              border: `1px solid ${esHoy ? `${BCN.teja}55` : BCN.arenaOsc}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 40, flexShrink: 0 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: esHoy ? BCN.teja : BCN.humo, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                    {diaCorto(f)}
                  </p>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: esHoy ? BCN.teja : BCN.tinta, margin: 0, lineHeight: 1.1 }}>
                    {numeroDia(f)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
                  {(Object.keys(TIPO_DIA) as TipoDia[]).map((t) => {
                    const activo = d.tipo === t;
                    const c = TIPO_DIA[t].color;
                    return (
                      <button key={t} onClick={() => elegirTipo(f, activo ? null : t)}
                        style={{
                          padding: "6px 10px", borderRadius: 16, cursor: "pointer",
                          border: `1px solid ${activo ? c : BCN.arenaOsc}`,
                          background: activo ? c : "white", color: activo ? "white" : BCN.tinta,
                          fontSize: 12, fontWeight: activo ? 700 : 500, transition: "all 0.15s",
                        }}>
                        {TIPO_DIA[t].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {d.tipo === "trabajo" && (
                <div style={{ marginTop: 8 }}>
                  <EditorTramos compacto tramos={d.tramos} onChange={(tramos) => cambiar(f, { tramos })} />
                  {problemas[f] && d.tramos.every((t) => t.inicio && t.fin) && (
                    <p style={{ fontSize: 12, color: BCN.teja, margin: "4px 0 0" }}>{problemas[f]}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Siempre a la vista, aunque la lista sea larga */}
      <div style={{
        // La hoja tiene relleno abajo: el botón lo cubre para pegarse al borde de la pantalla
        position: "sticky", bottom: "calc(-24px - env(safe-area-inset-bottom))",
        marginTop: 8, marginBottom: "calc(-24px - env(safe-area-inset-bottom))",
        padding: "12px 0", paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
        background: BCN.arena, boxShadow: `0 -10px 14px ${BCN.arena}`,
      }}>
        {error && <p style={{ fontSize: 13, color: BCN.teja, margin: "0 0 6px" }}>{error}</p>}
        <Boton onClick={guardar} disabled={guardando || hayProblemas} color={BCN.mar}>
          {guardando ? "Guardando…" : minutos ? `Guardar semana · ${textoHoras(minutos)}` : "Guardar semana"}
        </Boton>
      </div>
    </Hoja>
  );
}
