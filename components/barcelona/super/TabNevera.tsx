"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { sumarDias, fechaCorta } from "@/lib/barcelona/trabajo";
import {
  SECCIONES, LISTA_SECCIONES, anadirANevera, sacarDeNevera, actualizarNevera, pedirACocina, avisoAlergia,
  type ItemNevera, type RecetaNueva,
} from "@/lib/barcelona/super";
import { Vacio, estiloInput } from "../Shell";
import { Portada, Nutri, BotonIA, Pensando, Aviso, Etiqueta, VERDE } from "./Comun";

/* ═══════════════════════════════════════════════════════════
   La nevera y la despensa: lo que hay en casa. Se llena sola al
   dar una compra por hecha, y de aquí salen las ideas de
   "¿qué cocino con esto?".
   ═══════════════════════════════════════════════════════════ */

function caducidad(caduca: string | null, hoy: string): { texto: string; color: string } | null {
  if (!caduca) return null;
  if (caduca < hoy) return { texto: "caducado", color: BCN.teja };
  if (caduca === hoy) return { texto: "caduca hoy", color: BCN.teja };
  if (caduca === sumarDias(hoy, 1)) return { texto: "caduca mañana", color: BCN.sol };
  if (caduca <= sumarDias(hoy, 3)) return { texto: `caduca el ${fechaCorta(caduca)}`, color: BCN.sol };
  return { texto: `hasta el ${fechaCorta(caduca)}`, color: BCN.humo };
}

export function TabNevera({ hoy, quien, nevera, onCambio, abrirPrevia }: {
  hoy: string;
  quien: string;
  nevera: ItemNevera[];
  onCambio: () => void;
  abrirPrevia: (r: RecetaNueva) => void;
}) {
  const [texto, setTexto] = useState("");
  const [caduca, setCaduca] = useState("");
  const [deseo, setDeseo] = useState("");
  const [pensando, setPensando] = useState(false);
  const [ideas, setIdeas] = useState<RecetaNueva[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fechando, setFechando] = useState<string | null>(null);

  const anadir = async () => {
    const productos = texto.split(/[,\n]/).map((t) => t.trim()).filter(Boolean)
      .map((nombre) => ({ nombre, caduca: caduca || null }));
    if (!productos.length) return;
    setTexto("");
    setCaduca("");
    await anadirANevera(productos);
    onCambio();
  };

  const sacar = async (id: string) => {
    await sacarDeNevera([id]);
    onCambio();
  };

  const ponerFecha = async (id: string, fecha: string) => {
    setFechando(null);
    await actualizarNevera(id, { caduca: fecha || null });
    onCambio();
  };

  const queCocino = async () => {
    setPensando(true);
    setError(null);
    setIdeas(null);
    const res = await pedirACocina({ accion: "nevera", deseo }, quien);
    setPensando(false);
    if (!res.ok) return setError(res.error);
    setIdeas(res.recetas ?? []);
  };

  const prontoCaducan = nevera.filter((i) => i.caduca && i.caduca <= sumarDias(hoy, 2)).length;
  const porSeccion = LISTA_SECCIONES
    .map((s) => ({ seccion: s, items: nevera.filter((i) => i.seccion === s).sort((a, b) => (a.caduca ?? "9").localeCompare(b.caduca ?? "9")) }))
    .filter((g) => g.items.length);

  return (
    <div>
      {/* ¿Qué cocino? */}
      <div style={{
        borderRadius: 20, padding: "16px 16px 14px", marginBottom: 18,
        background: `linear-gradient(140deg, ${VERDE}18 0%, ${BCN.mar}12 100%)`, border: `1px solid ${VERDE}33`,
      }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 19, color: BCN.tinta, margin: 0 }}>¿Qué cocino con lo que hay?</p>
        <p style={{ fontSize: 13, color: BCN.humo, margin: "4px 0 12px" }}>
          {nevera.length ? `Con lo que tenéis${prontoCaducan ? `, empezando por lo que caduca (${prontoCaducan})` : ""}.` : "Apuntad abajo lo que tenéis, o decid qué os apetece."}
        </p>
        <input value={deseo} onChange={(e) => setDeseo(e.target.value)} placeholder="Me apetece… (opcional)"
          style={{ ...estiloInput, marginBottom: 10, background: "rgba(255,255,255,0.85)" }} />
        {pensando ? <Pensando texto="Abriendo la nevera" /> : <BotonIA onClick={queCocino} disabled={!nevera.length && !deseo.trim()}>Dame 3 ideas</BotonIA>}
        {error && <div style={{ marginTop: 10 }}><Aviso>{error}</Aviso></div>}

        <AnimatePresence>
          {ideas && ideas.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {ideas.map((r, i) => (
                <motion.button key={`${r.nombre}-${i}`} whileTap={{ scale: 0.98 }} onClick={() => abrirPrevia(r)}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  style={{
                    display: "flex", gap: 11, alignItems: "center", padding: 9, borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`,
                    background: "white", cursor: "pointer", textAlign: "left",
                  }}>
                  <div style={{ width: 58 }}><Portada receta={r} alto={58} radio={11} emoji={28} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 700, color: BCN.tinta, margin: 0 }}>{r.nombre}</p>
                    <p style={{ fontSize: 12, color: BCN.humo, margin: "2px 0 0" }}>
                      {r.tiempo_min ? `⏱ ${r.tiempo_min}′ · ` : ""}<Nutri r={r} />
                    </p>
                    {avisoAlergia(r) && <p style={{ fontSize: 11.5, color: BCN.teja, fontWeight: 700, margin: "2px 0 0" }}>⚠️ Lleva nueces</p>}
                  </div>
                  <span style={{ color: BCN.arenaOsc, fontSize: 18 }}>›</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Apuntar */}
      <form onSubmit={(e) => { e.preventDefault(); anadir(); }} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Añadir: pollo, espinacas…" style={{ ...estiloInput, flex: 1 }} />
        <button type="submit" disabled={!texto.trim()}
          style={{ width: 46, borderRadius: 12, border: "none", flexShrink: 0, fontSize: 22, cursor: "pointer", background: texto.trim() ? VERDE : BCN.arenaOsc, color: "white" }}>
          +
        </button>
      </form>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: BCN.humo, margin: "0 0 16px 3px" }}>
        Caduca (opcional):
        <input type="date" value={caduca} min={hoy} onChange={(e) => setCaduca(e.target.value)}
          style={{ ...estiloInput, width: "auto", padding: "6px 8px", fontSize: 13 }} />
      </label>

      {nevera.length === 0 ? (
        <Vacio icon="🥬" titulo="La nevera está vacía"
          texto="Se llena sola cuando dais una compra por hecha. También podéis apuntar aquí lo que tengáis." />
      ) : (
        porSeccion.map((g) => (
          <section key={g.seccion} style={{ marginBottom: 14 }}>
            <Etiqueta>{SECCIONES[g.seccion].icon} {SECCIONES[g.seccion].label}</Etiqueta>
            <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden" }}>
              {g.items.map((i, n) => {
                const c = caducidad(i.caduca, hoy);
                return (
                  <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px 10px 13px", borderBottom: n === g.items.length - 1 ? "none" : `1px solid ${BCN.arena}` }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14.5, color: BCN.tinta }}>{i.nombre}</span>
                      {(i.cantidad || c) && (
                        <span style={{ display: "block", fontSize: 12, color: c?.color ?? BCN.humo, fontWeight: c && c.color !== BCN.humo ? 700 : 400 }}>
                          {[i.cantidad, c?.texto].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    {fechando === i.id ? (
                      <input type="date" autoFocus defaultValue={i.caduca ?? ""} onBlur={() => setFechando(null)}
                        onChange={(e) => ponerFecha(i.id, e.target.value)}
                        style={{ ...estiloInput, width: "auto", padding: "5px 6px", fontSize: 12.5 }} />
                    ) : (
                      <button onClick={() => setFechando(i.id)} aria-label="Fecha de caducidad"
                        style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", padding: 6 }}>📅</button>
                    )}
                    <button onClick={() => sacar(i.id)} aria-label="Ya no queda"
                      style={{ background: "none", border: "none", fontSize: 12.5, color: BCN.humo, cursor: "pointer", padding: 6 }}>
                      Gastado
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
