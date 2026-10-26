"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { sumarDias, fechaCorta } from "@/lib/barcelona/trabajo";
import {
  SECCIONES, LISTA_SECCIONES, seccionDe, getPlan, calcularCompra, anadirALista, marcarComprado, borrarDeLista, cerrarCompra,
  type ItemLista, type ItemNevera, type Receta, type ProductoCompra, type Hueco,
} from "@/lib/barcelona/super";
import { Hoja, Boton, Vacio, estiloInput } from "../Shell";
import { BotonIA, Pensando, Aviso, Etiqueta, VERDE } from "./Comun";
import { huecosLibres, rellenarConIA } from "./Extras";

/* ═══════════════════════════════════════════════════════════
   La lista de la compra. Ordenada como se recorre el súper,
   con tick al ir metiendo en el carro y "Compra hecha" al final.
   ═══════════════════════════════════════════════════════════ */

export function TabCompra({ hoy, quien, lista, recetas, nevera, onCambio }: {
  hoy: string;
  quien: string;
  lista: ItemLista[];
  recetas: Receta[];
  nevera: ItemNevera[];
  onCambio: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<ItemLista[]>(lista);
  const [preparando, setPreparando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);

  // Copia local para que el tick responda al instante, sin esperar a la base de datos
  useEffect(() => { setItems(lista); }, [lista]);

  const pendientes = items.filter((i) => !i.comprado);
  const enCarro = items.filter((i) => i.comprado);

  const anadir = async () => {
    // "leche, huevos, pan" se apunta como tres cosas
    const productos = texto.split(/[,\n]/).map((t) => t.trim()).filter(Boolean).map((t) => {
      const m = t.match(/^(.*?)\s*\(([^)]+)\)\s*$/) ?? t.match(/^(.*?)\s+[x×]\s*(\d+.*)$/i);
      return m ? { nombre: m[1].trim(), cantidad: m[2].trim() } : { nombre: t, cantidad: null };
    });
    if (!productos.length) return;
    setTexto("");
    await anadirALista(productos.map((p) => ({ ...p, seccion: seccionDe(p.nombre) })), "manual", quien, items);
    onCambio();
    refInput.current?.focus();
  };

  const alternar = async (item: ItemLista) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, comprado: !i.comprado } : i)));
    const ok = await marcarComprado(item.id, !item.comprado);
    if (!ok) setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  };

  const quitar = async (item: ItemLista) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await borrarDeLista([item.id]);
    onCambio();
  };

  const porSeccion = LISTA_SECCIONES
    .map((s) => ({ seccion: s, items: pendientes.filter((i) => i.seccion === s) }))
    .filter((g) => g.items.length);

  return (
    <div style={{ paddingBottom: enCarro.length ? 80 : 0 }}>
      <form onSubmit={(e) => { e.preventDefault(); anadir(); }} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input ref={refInput} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Añadir: leche, huevos, pan…" enterKeyHint="done" style={{ ...estiloInput, flex: 1 }} />
        <button type="submit" disabled={!texto.trim()}
          style={{
            width: 46, borderRadius: 12, border: "none", flexShrink: 0, fontSize: 22, cursor: "pointer",
            background: texto.trim() ? VERDE : BCN.arenaOsc, color: "white",
          }}>
          +
        </button>
      </form>

      <div style={{ marginBottom: 16 }}>
        <BotonIA onClick={() => setPreparando(true)}>Preparar la compra con el menú</BotonIA>
      </div>

      {items.length === 0 ? (
        <Vacio icon="🛒" titulo="La lista está vacía"
          texto="Apuntad lo que falte, o dejad que la prepare la IA a partir del menú, con las cantidades justas." />
      ) : (
        <>
          {pendientes.length > 0 && (
            <p style={{ fontSize: 13, color: BCN.humo, margin: "0 0 10px 3px" }}>
              {pendientes.length} {pendientes.length === 1 ? "cosa pendiente" : "cosas pendientes"} · toca para meterla en el carro
            </p>
          )}

          {porSeccion.map((g) => (
            <section key={g.seccion} style={{ marginBottom: 14 }}>
              <Etiqueta>{SECCIONES[g.seccion].icon} {SECCIONES[g.seccion].label}</Etiqueta>
              <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden" }}>
                <AnimatePresence initial={false}>
                  {g.items.map((i, n) => (
                    <Fila key={i.id} item={i} ultima={n === g.items.length - 1} onTocar={() => alternar(i)} onQuitar={() => quitar(i)} />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}

          {enCarro.length > 0 && (
            <section style={{ marginTop: 8 }}>
              <Etiqueta>✓ En el carro ({enCarro.length})</Etiqueta>
              <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden", opacity: 0.75 }}>
                {enCarro.map((i, n) => (
                  <Fila key={i.id} item={i} ultima={n === enCarro.length - 1} onTocar={() => alternar(i)} onQuitar={() => quitar(i)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Compra hecha, siempre a mano cuando hay algo en el carro */}
      <AnimatePresence>
        {enCarro.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            style={{
              position: "fixed", left: 16, right: 16, bottom: "calc(16px + env(safe-area-inset-bottom))", zIndex: 30,
              maxWidth: 648, margin: "0 auto",
            }}>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setCerrando(true)}
              style={{
                width: "100%", padding: "15px", borderRadius: 16, border: "none", cursor: "pointer",
                background: BCN.tinta, color: "white", fontSize: 15, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}>
              ✓ Compra hecha · {enCarro.length} {enCarro.length === 1 ? "cosa" : "cosas"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <HojaPreparar abierta={preparando} hoy={hoy} quien={quien} recetas={recetas} nevera={nevera} lista={items}
        onCerrar={() => setPreparando(false)} onCambio={onCambio} />
      <HojaCompraHecha abierta={cerrando} comprados={enCarro} onCerrar={() => setCerrando(false)} onCambio={onCambio} />
    </div>
  );
}

function Fila({ item, ultima, onTocar, onQuitar }: { item: ItemLista; ultima: boolean; onTocar: () => void; onQuitar: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
      style={{ display: "flex", alignItems: "center", borderBottom: ultima ? "none" : `1px solid ${BCN.arena}` }}>
      <button onClick={onTocar}
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", background: "none", border: "none", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
        <motion.span animate={{ scale: item.comprado ? [1, 1.25, 1] : 1 }}
          style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
            border: `2px solid ${item.comprado ? VERDE : BCN.arenaOsc}`, background: item.comprado ? VERDE : "white",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 800,
          }}>
          {item.comprado ? "✓" : ""}
        </motion.span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 15, color: BCN.tinta, textDecoration: item.comprado ? "line-through" : "none" }}>{item.nombre}</span>
          {item.cantidad && <span style={{ display: "block", fontSize: 12, color: BCN.humo }}>{item.cantidad}</span>}
        </span>
        {item.origen !== "manual" && <span style={{ fontSize: 11, color: VERDE }} title="Del menú">🗓️</span>}
      </button>
      <button onClick={onQuitar} aria-label="Quitar"
        style={{ width: 40, alignSelf: "stretch", background: "none", border: "none", color: BCN.arenaOsc, fontSize: 15, cursor: "pointer" }}>
        ✕
      </button>
    </motion.div>
  );
}

/* ─── Preparar la compra desde el menú ─────────────────────── */

const PERIODOS = [
  { dias: 3, label: "3 días" },
  { dias: 7, label: "1 semana" },
  { dias: 14, label: "2 semanas" },
];

function HojaPreparar({ abierta, hoy, quien, recetas, nevera, lista, onCerrar, onCambio }: {
  abierta: boolean; hoy: string; quien: string; recetas: Receta[]; nevera: ItemNevera[]; lista: ItemLista[];
  onCerrar: () => void; onCambio: () => void;
}) {
  const [dias, setDias] = useState(7);
  const [plan, setPlan] = useState<Hueco[] | null>(null);
  const [rellenando, setRellenando] = useState<{ hechas: number; total: number } | null>(null);
  const [propuesta, setPropuesta] = useState<{ productos: ProductoCompra[]; yaTeneis: string[] } | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Desde la cena de hoy: la comida de hoy ya se cocinó anoche
  const hasta = sumarDias(hoy, dias);

  const leerPlan = async () => setPlan(await getPlan(hoy, hasta));

  useEffect(() => {
    if (!abierta) return;
    setPropuesta(null); setError(null); setMensaje(null); setPlan(null);
    leerPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, dias]);

  const libres = plan ? huecosLibres(hoy, hasta, plan, hoy) : [];
  const conPlato = plan ? plan.filter((h) => h.receta_id && !h.hecho && !(h.fecha === hoy && h.momento === "comida")) : [];

  const rellenar = async () => {
    setError(null);
    setRellenando({ hechas: 0, total: 1 });
    const res = await rellenarConIA(libres, "", quien, (hechas, total) => setRellenando({ hechas, total }));
    setRellenando(null);
    if (res.error) setError(res.error);
    onCambio();
    await leerPlan();
  };

  const calcular = () => {
    if (!plan) return;
    // Las recetas recién creadas por la IA pueden no estar aún en `recetas`: se piden al calcular
    const res = calcularCompra(conPlato, recetas, nevera);
    setPropuesta(res);
    setMarcados(new Set(res.productos.map((_, i) => i)));
  };

  // Si la IA acaba de crear recetas, la lista de recetas se recarga y se recalcula
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (propuesta) calcular(); }, [recetas]);

  const anadir = async () => {
    if (!propuesta) return;
    const elegidos = propuesta.productos.filter((_, i) => marcados.has(i));
    const n = await anadirALista(elegidos, "menu", quien, lista);
    if (n === null) return setError("No se ha podido añadir. Prueba otra vez.");
    onCambio();
    setMensaje(n === 0 ? "Ya estaba todo en la lista 👌" : `${n} ${n === 1 ? "cosa añadida" : "cosas añadidas"} a la lista 🛒`);
    setTimeout(onCerrar, 1200);
  };

  return (
    <Hoja abierta={abierta} onCerrar={() => { if (!rellenando) onCerrar(); }} titulo="Preparar la compra">
      {rellenando ? (
        <Pensando texto={rellenando.total > 1 ? `Menú: semana ${Math.min(rellenando.hechas + 1, rellenando.total)} de ${rellenando.total}` : "Completando el menú"} />
      ) : !propuesta ? (
        <>
          <Etiqueta>¿Para cuántos días compráis?</Etiqueta>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {PERIODOS.map((p) => (
              <button key={p.dias} onClick={() => setDias(p.dias)}
                style={{
                  flex: 1, padding: "11px 6px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: dias === p.dias ? 700 : 500,
                  border: `1.5px solid ${dias === p.dias ? VERDE : BCN.arenaOsc}`, background: dias === p.dias ? `${VERDE}12` : "white",
                  color: dias === p.dias ? VERDE : BCN.tinta,
                }}>
                {p.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 13, color: BCN.humo, margin: "0 0 12px" }}>
            Desde la cena de hoy hasta el {fechaCorta(hasta)}.
          </p>

          {!plan ? (
            <p style={{ fontSize: 13, color: BCN.humo }}>Mirando el menú…</p>
          ) : (
            <>
              <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, padding: "12px 14px", marginBottom: 12 }}>
                <p style={{ fontSize: 14, color: BCN.tinta, margin: 0 }}>
                  🗓️ <strong>{conPlato.length}</strong> {conPlato.length === 1 ? "plato decidido" : "platos decididos"}
                  {libres.length > 0 && <> · <strong style={{ color: BCN.teja }}>{libres.length}</strong> {libres.length === 1 ? "hueco libre" : "huecos libres"}</>}
                </p>
              </div>

              {libres.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <BotonIA onClick={rellenar}>Que la IA complete los {libres.length} huecos</BotonIA>
                  <p style={{ fontSize: 12, color: BCN.humo, margin: "6px 0 0", textAlign: "center" }}>
                    Así la compra sale entera. Luego podéis cambiar lo que queráis.
                  </p>
                </div>
              )}

              {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}

              <Boton onClick={calcular} disabled={conPlato.length === 0} color={BCN.tinta}>
                {conPlato.length === 0 ? "Primero, algo en el menú" : `Calcular la compra de ${conPlato.length} ${conPlato.length === 1 ? "plato" : "platos"}`}
              </Boton>
            </>
          )}
        </>
      ) : (
        <>
          {propuesta.productos.length === 0 ? (
            <Aviso color={VERDE}>¡Lo tenéis todo! No hace falta comprar nada para esos platos. 🎉</Aviso>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: BCN.tinta, margin: "-6px 0 12px" }}>
                Cantidades sumadas de todos los platos para dos. Quitad lo que no haga falta.
              </p>
              <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden", marginBottom: 12 }}>
                {propuesta.productos.map((p, i) => {
                  const dentro = marcados.has(i);
                  return (
                    <button key={`${p.nombre}-${i}`}
                      onClick={() => setMarcados((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s; })}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", border: "none",
                        borderBottom: i === propuesta.productos.length - 1 ? "none" : `1px solid ${BCN.arena}`,
                        background: "white", cursor: "pointer", textAlign: "left", opacity: dentro ? 1 : 0.45,
                      }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${dentro ? VERDE : BCN.arenaOsc}`,
                        background: dentro ? VERDE : "white", color: "white", fontSize: 12, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{dentro ? "✓" : ""}</span>
                      <span style={{ fontSize: 13 }}>{SECCIONES[p.seccion].icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 14, color: BCN.tinta }}>{p.nombre}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Para {p.para.join(", ")}
                        </span>
                      </span>
                      {p.cantidad && <span style={{ fontSize: 13, color: BCN.tinta, fontWeight: 600, flexShrink: 0 }}>{p.cantidad}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {propuesta.yaTeneis.length > 0 && (
            <p style={{ fontSize: 12.5, color: BCN.humo, margin: "0 0 12px", lineHeight: 1.5 }}>
              🥬 Ya lo tenéis en la nevera: {propuesta.yaTeneis.join(", ")}.
            </p>
          )}

          {mensaje ? (
            <Aviso color={VERDE}>{mensaje}</Aviso>
          ) : (
            <>
              {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}
              {propuesta.productos.length > 0 && (
                <Boton onClick={anadir} disabled={marcados.size === 0} color={VERDE}>
                  Añadir {marcados.size} a la lista
                </Boton>
              )}
              <button onClick={() => setPropuesta(null)}
                style={{ width: "100%", marginTop: 6, padding: 10, background: "none", border: "none", color: BCN.humo, fontSize: 13, cursor: "pointer" }}>
                ‹ Volver
              </button>
            </>
          )}
        </>
      )}
    </Hoja>
  );
}

/* ─── Compra hecha ─────────────────────────────────────────── */

function HojaCompraHecha({ abierta, comprados, onCerrar, onCambio }: {
  abierta: boolean; comprados: ItemLista[]; onCerrar: () => void; onCambio: () => void;
}) {
  const [aNevera, setANevera] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (abierta) { setANevera(true); setError(null); } }, [abierta]);

  const cerrar = async () => {
    setGuardando(true);
    const ok = await cerrarCompra(comprados, aNevera);
    setGuardando(false);
    if (!ok) return setError("No se ha podido guardar. Prueba otra vez.");
    onCambio();
    onCerrar();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="¡Compra hecha! 🛍️">
      <p style={{ fontSize: 14, color: BCN.tinta, margin: "-6px 0 14px", lineHeight: 1.5 }}>
        Sale de la lista lo que tenéis en el carro ({comprados.length} {comprados.length === 1 ? "cosa" : "cosas"}). Lo que quede sin marcar se queda para la próxima.
      </p>

      <button onClick={() => setANevera((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left",
          border: `1.5px solid ${aNevera ? VERDE : BCN.arenaOsc}`, background: aNevera ? `${VERDE}10` : "white", marginBottom: 14,
        }}>
        <span style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: `2px solid ${aNevera ? VERDE : BCN.arenaOsc}`,
          background: aNevera ? VERDE : "white", color: "white", fontSize: 13, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{aNevera ? "✓" : ""}</span>
        <span>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: BCN.tinta }}>Guardarlo en la nevera</span>
          <span style={{ display: "block", fontSize: 12.5, color: BCN.humo }}>Así «¿Qué cocino?» sabe lo que tenéis en casa</span>
        </span>
      </button>

      {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}
      <Boton onClick={cerrar} disabled={guardando} color={VERDE}>{guardando ? "Guardando…" : "Listo"}</Boton>
    </Hoja>
  );
}
