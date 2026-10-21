"use client";

import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import {
  TIPO_DIA, rejillaMes, numeroDia, sumarMeses, mesCorto, minutosTurno, horasCortas,
  totalVentas, euros, type TipoDia, type Turno, type Venta,
} from "@/lib/barcelona/trabajo";

/* ═══════════════════════════════════════════════════════════
   Las vistas largas del horario: el mes como calendario y el
   año como doce meses en miniatura. Todo se toca: un día abre
   ese día, un mes abre ese mes.
   ═══════════════════════════════════════════════════════════ */

const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];

/* ─── Mes ──────────────────────────────────────────────────── */

export function VistaMes({ mes, hoy, turnos, ventas, conVentas, onDia }: {
  /** Cualquier día del mes que se pinta. */
  mes: string;
  hoy: string;
  turnos: Turno[];
  ventas: Venta[];
  conVentas: boolean;
  onDia: (fecha: string) => void;
}) {
  const dias = rejillaMes(mes);
  const prefijo = mes.slice(0, 7);
  const turnoDe = (f: string) => turnos.find((t) => t.fecha === f);
  const conVenta = new Set(ventas.map((v) => v.fecha));

  return (
    <div>
      <div style={{ background: "white", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, padding: "10px 8px 8px", boxShadow: "0 2px 10px rgba(44,36,32,0.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
          {INICIALES.map((d) => (
            <p key={d} style={{ fontSize: 10.5, fontWeight: 700, color: BCN.humo, textAlign: "center", margin: 0 }}>{d}</p>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {dias.map((f) => {
            const fuera = !f.startsWith(prefijo);
            const turno = turnoDe(f);
            const cfg = turno ? TIPO_DIA[turno.tipo] : null;
            const esHoy = f === hoy;
            const minutos = minutosTurno(turno);
            return (
              <motion.button
                key={f}
                whileTap={{ scale: 0.92 }}
                onClick={() => onDia(f)}
                aria-label={f}
                style={{
                  position: "relative", aspectRatio: "1 / 1.12", minWidth: 0,
                  borderRadius: 10, cursor: "pointer", padding: "5px 2px 4px",
                  border: esHoy ? `2px solid ${BCN.teja}` : "2px solid transparent",
                  background: cfg ? `${cfg.color}${turno?.tipo === "trabajo" ? "1C" : "16"}` : BCN.arena,
                  opacity: fuera ? 0.35 : 1,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: esHoy ? 800 : 600, color: esHoy ? BCN.teja : BCN.tinta, lineHeight: 1 }}>
                  {numeroDia(f)}
                </span>
                <span style={{
                  fontSize: turno?.tipo === "trabajo" ? 10.5 : 12, lineHeight: 1,
                  color: cfg?.color ?? "transparent", fontWeight: 700, fontVariantNumeric: "tabular-nums",
                }}>
                  {turno?.tipo === "trabajo" ? horasCortas(minutos) : cfg ? cfg.icon : "·"}
                </span>
                {conVentas && conVenta.has(f) && (
                  <span style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: BCN.oliva }} />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <Leyenda conVentas={conVentas} />
    </div>
  );
}

function Leyenda({ conVentas }: { conVentas: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", justifyContent: "center", margin: "10px 0 0" }}>
      {(Object.keys(TIPO_DIA) as TipoDia[]).map((t) => (
        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: BCN.humo }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: TIPO_DIA[t].color }} />
          {TIPO_DIA[t].label}
        </span>
      ))}
      {conVentas && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: BCN.humo }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: BCN.oliva }} />
          Con ventas
        </span>
      )}
    </div>
  );
}

/* ─── Año ──────────────────────────────────────────────────── */

export function VistaAno({ ano, hoy, turnos, ventas, conVentas, onMes }: {
  /** "2026" */
  ano: string;
  hoy: string;
  turnos: Turno[];
  ventas: Venta[];
  conVentas: boolean;
  onMes: (primerDia: string) => void;
}) {
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(`${ano}-01-01`, i));
  const porFecha = new Map(turnos.map((t) => [t.fecha, t]));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
      {meses.map((m, i) => {
        const prefijo = m.slice(0, 7);
        const turnosMes = turnos.filter((t) => t.fecha.startsWith(prefijo));
        const minutos = turnosMes.reduce((s, t) => s + minutosTurno(t), 0);
        const ventasMes = ventas.filter((v) => v.fecha.startsWith(prefijo));
        const esActual = hoy.startsWith(prefijo);
        const vacio = turnosMes.length === 0;

        return (
          <motion.button
            key={m}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02, duration: 0.25 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onMes(m)}
            style={{
              background: "white", borderRadius: 14, padding: "11px 11px 10px", cursor: "pointer", textAlign: "left",
              border: `1.5px solid ${esActual ? BCN.teja : BCN.arenaOsc}`,
              opacity: vacio ? 0.6 : 1,
            }}
          >
            <p style={{ fontFamily: "Georgia, serif", fontSize: 15, color: esActual ? BCN.teja : BCN.tinta, margin: "0 0 7px", textTransform: "capitalize" }}>
              {mesCorto(m)}
            </p>

            {/* El mes en miniatura: un cuadradito por día, con su color */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {rejillaMes(m).map((f) => {
                if (!f.startsWith(prefijo)) return <span key={f} />;
                const t = porFecha.get(f);
                return (
                  <span key={f} style={{
                    aspectRatio: "1", borderRadius: 2.5,
                    background: t ? TIPO_DIA[t.tipo].color : BCN.arena,
                    opacity: t?.tipo === "trabajo" ? 0.85 : t ? 0.55 : 1,
                    outline: f === hoy ? `1.5px solid ${BCN.teja}` : "none",
                  }} />
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: vacio ? BCN.humo : BCN.mar, fontWeight: 700, margin: "8px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {vacio ? "Sin horario" : horasCortas(minutos).replace("h", " h")}
            </p>
            {conVentas && ventasMes.length > 0 && (
              <p style={{ fontSize: 11.5, color: BCN.oliva, fontWeight: 600, margin: "1px 0 0", fontVariantNumeric: "tabular-nums" }}>
                {euros(totalVentas(ventasMes))}
              </p>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
