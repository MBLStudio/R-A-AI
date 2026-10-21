"use client";

import { useState, useEffect, useRef } from "react";
import { BCN } from "@/lib/barcelona/types";
import {
  fechaCorta, hoyMadrid, horaMadrid, leerPrecio, guardarVenta, borrarVenta,
  type Persona, type Venta,
} from "@/lib/barcelona/trabajo";
import { Hoja, Campo, Boton, estiloInput } from "./Shell";

/* ═══════════════════════════════════════════════════════════
   Apuntar una venta. Tiene que ser más rápido que no apuntarla:
   foco directo en el nombre, Intro salta al precio, Intro en el
   precio guarda. La hora se pone sola.
   ═══════════════════════════════════════════════════════════ */

export function HojaVenta({ abierta, persona, onCerrar, onGuardado }: {
  /** fecha del día y, si se está editando, la venta. null = cerrada. */
  abierta: { fecha: string; venta: Venta | null } | null;
  persona: Persona;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refPrecio = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const v = abierta.venta;
    setNombre(v?.nombre ?? "");
    setPrecio(v ? v.precio.toFixed(2).replace(".", ",") : "");
    setHora(v?.hora ?? horaMadrid());
    setNota(v?.nota ?? "");
    setError(null);
  }, [abierta]);

  const importe = leerPrecio(precio);
  const valida = nombre.trim().length > 0 && importe !== null && /^\d{2}:\d{2}$/.test(hora);

  // Candado síncrono: el estado tarda un render y un doble toque apuntaría la venta dos veces
  const enviando = useRef(false);

  const guardar = async () => {
    if (!abierta || !valida || importe === null || enviando.current) return;
    enviando.current = true;
    setGuardando(true);
    setError(null);
    const ok = await guardarVenta(persona, { fecha: abierta.fecha, hora, nombre, precio: importe, nota }, abierta.venta?.id);
    enviando.current = false;
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar. Prueba otra vez."); return; }
    onGuardado();
    onCerrar();
  };

  const borrar = async () => {
    const v = abierta?.venta;
    if (!v || !confirm(`¿Borrar "${v.nombre}"?`)) return;
    const ok = await borrarVenta(v.id);
    if (!ok) { setError("No se pudo borrar. Prueba otra vez."); return; }
    onGuardado();
    onCerrar();
  };

  const titulo = !abierta ? "" :
    `${abierta.venta ? "Editar venta" : "Nueva venta"}${abierta.fecha !== hoyMadrid() ? ` · ${fechaCorta(abierta.fecha)}` : ""}`;

  return (
    <Hoja abierta={abierta !== null} onCerrar={onCerrar} titulo={titulo}>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }}>
        <Campo label="Qué has vendido">
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Gafas de sol, graduadas + cristales…"
            enterKeyHint="next"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); refPrecio.current?.focus(); } }}
            style={estiloInput} />
        </Campo>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1.4, minWidth: 0 }}>
            <Campo label="Precio">
              <div style={{ position: "relative" }}>
                <input ref={refPrecio} value={precio} onChange={(e) => setPrecio(e.target.value)}
                  inputMode="decimal" enterKeyHint="done" placeholder="0,00"
                  style={{ ...estiloInput, fontWeight: 700, fontSize: 17, paddingRight: 32, fontVariantNumeric: "tabular-nums" }} />
                <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", color: BCN.humo, fontSize: 15 }}>€</span>
              </div>
            </Campo>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Campo label="Hora">
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                style={{ ...estiloInput, fontVariantNumeric: "tabular-nums" }} />
            </Campo>
          </div>
        </div>

        <Campo label="Nota (opcional)">
          <input value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Clienta habitual, encargo…" style={estiloInput} />
        </Campo>

        {(error || (precio && importe === null)) && (
          <p style={{ fontSize: 13, color: BCN.teja, margin: "0 0 8px" }}>
            {error ?? "Ese precio no se entiende. Ejemplo: 129,90"}
          </p>
        )}

        {/* Dentro de un form, Boton es el submit: guarda el toque y también el Intro del teclado */}
        <Boton onClick={() => {}} disabled={!valida || guardando} color={BCN.teja}>
          {guardando ? "Guardando…" : "Guardar venta"}
        </Boton>
      </form>

      {abierta?.venta && (
        <button onClick={borrar}
          style={{ width: "100%", marginTop: 8, padding: 10, background: "none", border: "none", color: BCN.humo, fontSize: 13, cursor: "pointer" }}>
          Borrar venta
        </button>
      )}
    </Hoja>
  );
}
