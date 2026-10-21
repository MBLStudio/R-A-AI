"use client";

import { useState, useEffect } from "react";
import { BCN } from "@/lib/barcelona/types";
import {
  TIPO_DIA, fechaLarga, hoyMadrid, guardarTurno, borrarTurno, revisarTramos,
  minutosTurno, textoHoras,
  type Persona, type Turno, type Tramo, type TipoDia,
} from "@/lib/barcelona/trabajo";
import { Hoja, Campo, Boton, Selector, estiloInput } from "./Shell";

/* ═══════════════════════════════════════════════════════════
   La hoja de un día: su turno (o libre / vacaciones) y la nota.
   Las ventas viven en el propio día, en la semana.
   ═══════════════════════════════════════════════════════════ */

export function HojaTurno({ fecha, persona, turno, sugerencia, onCerrar, onGuardado }: {
  fecha: string | null;
  persona: Persona;
  turno: Turno | null;
  /** Tramos con los que empezar un día nuevo (los del día de trabajo más cercano). */
  sugerencia: Tramo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState<TipoDia>("trabajo");
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada vez que se abre un día, el formulario arranca con lo que hay guardado
  useEffect(() => {
    if (!fecha) return;
    setTipo(turno?.tipo ?? "trabajo");
    setTramos(turno?.tramos.length ? turno.tramos : sugerencia.length ? sugerencia : [{ inicio: "", fin: "" }]);
    setNota(turno?.nota ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, turno?.id]);

  const problema = tipo === "trabajo" ? revisarTramos(tramos) : null;
  const minutos = tipo === "trabajo" && !problema ? minutosTurno({ tipo, tramos }) : 0;
  const esHoy = fecha === hoyMadrid();

  const guardar = async () => {
    if (!fecha || problema) return;
    setGuardando(true);
    setError(null);
    const ok = await guardarTurno(persona, fecha, { tipo, tramos, nota });
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar. Prueba otra vez."); return; }
    onGuardado();
    onCerrar();
  };

  const borrar = async () => {
    if (!fecha || !confirm("¿Borrar el horario de este día?")) return;
    const ok = await borrarTurno(persona, fecha);
    if (!ok) { setError("No se pudo borrar. Prueba otra vez."); return; }
    onGuardado();
    onCerrar();
  };

  const color = TIPO_DIA[tipo].color;

  return (
    <Hoja abierta={fecha !== null} onCerrar={onCerrar} titulo={fecha ? `${fechaLarga(fecha)}${esHoy ? " · hoy" : ""}` : ""}>
      <Selector<TipoDia>
        valor={tipo}
        color={color}
        onChange={setTipo}
        opciones={(Object.keys(TIPO_DIA) as TipoDia[]).map((t) => ({ valor: t, label: TIPO_DIA[t].label, icon: TIPO_DIA[t].icon }))}
      />

      <div style={{ height: 16 }} />

      {tipo === "trabajo" && (
        <Campo label={minutos ? `Turno · ${textoHoras(minutos)}` : "Turno"}>
          <EditorTramos tramos={tramos} onChange={setTramos} />
        </Campo>
      )}

      <Campo label="Nota">
        <input value={nota} onChange={(e) => setNota(e.target.value)}
          placeholder="Inventario, cubro a una compañera…" style={estiloInput} />
      </Campo>

      {(problema && tramos.every((t) => t.inicio && t.fin)) || error ? (
        <p style={{ fontSize: 13, color: BCN.teja, margin: "0 0 8px" }}>{error ?? problema}</p>
      ) : null}

      <Boton onClick={guardar} disabled={guardando || !!problema} color={color}>
        {guardando ? "Guardando…" : "Guardar"}
      </Boton>

      {turno && (
        <button onClick={borrar}
          style={{ width: "100%", marginTop: 8, padding: 10, background: "none", border: "none", color: BCN.humo, fontSize: 13, cursor: "pointer" }}>
          Borrar este día
        </button>
      )}
    </Hoja>
  );
}

/* ─── Editor de tramos (también lo usa la hoja de la semana) ── */

export function EditorTramos({ tramos, onChange, compacto = false }: {
  tramos: Tramo[];
  onChange: (t: Tramo[]) => void;
  compacto?: boolean;
}) {
  const cambiar = (i: number, campo: keyof Tramo, valor: string) =>
    onChange(tramos.map((t, j) => (j === i ? { ...t, [campo]: valor } : t)));

  const estiloHora: React.CSSProperties = {
    ...estiloInput,
    padding: compacto ? "8px 10px" : "11px 12px",
    fontSize: compacto ? 14 : 16,
    fontVariantNumeric: "tabular-nums",
    minWidth: 0, flex: 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compacto ? 6 : 8 }}>
      {tramos.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="time" value={t.inicio} onChange={(e) => cambiar(i, "inicio", e.target.value)}
            aria-label="Entrada" style={estiloHora} />
          <span style={{ color: BCN.humo }}>–</span>
          <input type="time" value={t.fin} onChange={(e) => cambiar(i, "fin", e.target.value)}
            aria-label="Salida" style={estiloHora} />
          {tramos.length > 1 && (
            <button onClick={() => onChange(tramos.filter((_, j) => j !== i))} aria-label="Quitar tramo"
              style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", border: "none", background: BCN.arenaOsc, color: BCN.tinta, cursor: "pointer", fontSize: 14 }}>
              ✕
            </button>
          )}
        </div>
      ))}
      {tramos.length < 2 && (
        <button onClick={() => onChange([...tramos, { inicio: "", fin: "" }])}
          style={{
            alignSelf: "flex-start", padding: compacto ? "4px 0" : "6px 0", background: "none", border: "none",
            color: BCN.mar, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          + Turno partido
        </button>
      )}
    </div>
  );
}
