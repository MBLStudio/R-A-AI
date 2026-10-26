"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { subirFoto } from "@/lib/upload";
import { hoyMadrid, sumarDias, fechaCorta } from "@/lib/barcelona/trabajo";
import {
  DIFICULTAD, MOMENTOS, escalar, textoCantidad, avisoAlergia, anadirALista, crearReceta,
  actualizarReceta, borrarReceta, guardarHueco, pedirACocina, buscarEnTikTok, buscarEnPinterest, buscarEnYouTube,
  type Receta, type RecetaNueva, type ItemLista, type Momento, type Valoracion,
} from "@/lib/barcelona/super";
import { Hoja } from "../Shell";
import { Portada, Nutri, BotonesValoracion, BotonIA, Aviso, Etiqueta, Pensando, VERDE } from "./Comun";

/* ═══════════════════════════════════════════════════════════
   La ficha de un plato. Sirve para los guardados y para los que
   propone la IA antes de guardarlos (la "previa").
   ═══════════════════════════════════════════════════════════ */

export function FichaReceta({ receta, previa, quien, lista, onCerrar, onCambio, onGuardada }: {
  /** Una receta del recetario. */
  receta: Receta | null;
  /** Una propuesta todavía sin guardar. */
  previa?: RecetaNueva | null;
  quien: string;
  lista: ItemLista[];
  onCerrar: () => void;
  onCambio: () => void;
  /** Al guardar una previa, la ficha pasa a la receta guardada. */
  onGuardada?: (r: Receta) => void;
}) {
  const abierta = receta !== null || !!previa;
  const [actual, setActual] = useState<Receta | null>(receta);
  const [raciones, setRaciones] = useState(2);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<null | "pasos" | "foto" | "guardar">(null);
  const [eligiendoDia, setEligiendoDia] = useState(false);
  const refFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActual(receta);
    setRaciones(receta?.raciones ?? previa?.raciones ?? 2);
    setAviso(null);
    setEligiendoDia(false);
  }, [receta, previa]);

  // La última receta se queda mientras la hoja baja, para que no se vacíe a medio cerrar
  const [ultima, setUltima] = useState<RecetaNueva | Receta | null>(null);
  const viva: RecetaNueva | Receta | null = abierta ? actual ?? previa ?? null : null;
  if (viva && viva !== ultima) setUltima(viva);
  const r = viva ?? ultima;
  if (!r) return <Hoja abierta={false} onCerrar={onCerrar} titulo=""><span /></Hoja>;

  const guardada = actual !== null;
  const ingredientes = escalar(r.ingredientes, r.raciones, raciones);
  const alergia = avisoAlergia(r);

  const decir = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso((a) => (a === t ? null : a)), 3500);
  };

  const cambiar = async (cambios: Partial<Receta>) => {
    if (!actual) return;
    setActual({ ...actual, ...cambios });
    const ok = await actualizarReceta(actual.id, cambios);
    if (!ok) decir("No se ha podido guardar el cambio.");
    onCambio();
  };

  const guardar = async () => {
    if (!previa) return;
    setOcupado("guardar");
    const nueva = await crearReceta(previa, quien);
    setOcupado(null);
    if (!nueva) return decir("No se ha podido guardar. Prueba otra vez.");
    setActual(nueva);
    onGuardada?.(nueva);
    onCambio();
    decir("Guardada en vuestro recetario 📖");
  };

  const aLaCompra = async () => {
    const productos = ingredientes.map((i) => ({
      nombre: i.nombre,
      // Las cucharadas y pizcas no se compran por cantidad
      cantidad: !i.cantidad || i.unidad === "cda" || i.unidad === "cdta" || i.unidad === "pizca" ? null : textoCantidad(i.cantidad, i.unidad),
      seccion: i.seccion,
    }));
    const n = await anadirALista(productos, "receta", quien, lista);
    if (n === null) return decir("No se ha podido añadir. Prueba otra vez.");
    onCambio();
    decir(n === 0 ? "Ya estaba todo en la lista 👌" : `${n} ${n === 1 ? "cosa añadida" : "cosas añadidas"} a la compra 🛒`);
  };

  const ponerEnMenu = async (fecha: string, momento: Momento) => {
    if (!actual) return;
    const ok = await guardarHueco(fecha, momento, { receta_id: actual.id, texto: null, raciones: 2 });
    setEligiendoDia(false);
    if (!ok) return decir("No se ha podido poner en el menú.");
    onCambio();
    decir(`Puesto para la ${MOMENTOS[momento].label.toLowerCase()} del ${fechaCorta(fecha)} 🗓️`);
  };

  const verPasos = async () => {
    if (!actual) return;
    setOcupado("pasos");
    const res = await pedirACocina({ accion: "pasos", receta_id: actual.id }, quien);
    setOcupado(null);
    if (!res.ok) return decir(res.error);
    if (res.receta) setActual({ ...res.receta, ingredientes: actual.ingredientes, pasos: res.receta.pasos ?? [] });
    onCambio();
  };

  const subir = async (file: File) => {
    if (!actual) return;
    setOcupado("foto");
    const { url, error } = await subirFoto(file, "recetas");
    setOcupado(null);
    if (!url) return decir(error ?? "No se ha podido subir la foto.");
    await cambiar({ foto_url: url });
    decir("¡Qué buena pinta! 📸");
  };

  const borrar = async () => {
    if (!actual || !confirm(`¿Borrar "${actual.nombre}" del recetario?`)) return;
    const ok = await borrarReceta(actual.id);
    if (!ok) return decir("No se ha podido borrar.");
    onCambio();
    onCerrar();
  };

  const hoy = hoyMadrid();
  const proximos = Array.from({ length: 8 }, (_, i) => sumarDias(hoy, i));

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={r.nombre}>
      {/* Portada */}
      <div style={{ position: "relative", marginTop: -6 }}>
        <Portada receta={{ nombre: r.nombre, foto_url: actual?.foto_url ?? null }} alto={190} radio={18} emoji={72} />
        {guardada && (
          <>
            <button onClick={() => refFoto.current?.click()} disabled={ocupado === "foto"}
              style={{
                position: "absolute", right: 10, bottom: 10, padding: "7px 12px", borderRadius: 18, border: "none",
                background: "rgba(255,255,255,0.92)", color: BCN.tinta, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}>
              {ocupado === "foto" ? "Subiendo…" : actual?.foto_url ? "📷 Cambiar foto" : "📷 Vuestra foto"}
            </button>
            <input ref={refFoto} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = ""; }} />
          </>
        )}
      </div>

      {r.descripcion && (
        <p style={{ fontSize: 14.5, color: BCN.tinta, lineHeight: 1.5, margin: "12px 0 0" }}>{r.descripcion}</p>
      )}

      {/* Datos rápidos */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 0" }}>
        {r.tiempo_min && <Chip>⏱ {r.tiempo_min} min</Chip>}
        {r.dificultad && <Chip>{DIFICULTAD[r.dificultad]}</Chip>}
        {r.etiquetas.map((e) => <Chip key={e} color={VERDE}>{e}</Chip>)}
      </div>

      {alergia && <div style={{ marginTop: 12 }}><Aviso>⚠️ <strong>{alergia}.</strong> Revisadla antes de cocinar.</Aviso></div>}
      {r.nota && !r.nota.startsWith("⚠️") && (
        <div style={{ marginTop: 10 }}><Aviso color={BCN.humo}>{r.nota}</Aviso></div>
      )}

      {/* Valoración */}
      {guardada && actual && (
        <div style={{ marginTop: 16 }}>
          <Etiqueta>¿Qué os ha parecido?</Etiqueta>
          <BotonesValoracion valor={actual.valoracion} onChange={(v: Valoracion | null) => cambiar({ valoracion: v })} />
          {actual.veces > 0 && (
            <p style={{ fontSize: 12, color: BCN.humo, margin: "7px 0 0 3px" }}>
              La habéis hecho {actual.veces === 1 ? "una vez" : `${actual.veces} veces`}
              {actual.ultima_vez ? ` · la última, el ${fechaCorta(actual.ultima_vez)}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Nutrición */}
      {r.kcal_racion !== null && (
        <div style={{ marginTop: 18 }}>
          <Etiqueta>Por ración (aprox.)</Etiqueta>
          <Nutri r={r} amplio />
        </div>
      )}

      {/* Ingredientes */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Etiqueta>Ingredientes</Etiqueta>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -8 }}>
            <Paso onClick={() => setRaciones((n) => Math.max(1, n - 1))}>−</Paso>
            <span style={{ fontSize: 13, color: BCN.tinta, fontWeight: 600, minWidth: 74, textAlign: "center" }}>
              {raciones} {raciones === 1 ? "ración" : "raciones"}
            </span>
            <Paso onClick={() => setRaciones((n) => Math.min(20, n + 1))}>+</Paso>
          </div>
        </div>
        <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden" }}>
          {ingredientes.map((i, n) => (
            <div key={`${i.nombre}-${n}`} style={{
              display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 13px",
              borderBottom: n === ingredientes.length - 1 ? "none" : `1px solid ${BCN.arena}`,
            }}>
              <span style={{ fontSize: 14, color: BCN.tinta }}>{i.nombre}</span>
              <span style={{ fontSize: 13, color: BCN.humo, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {textoCantidad(Math.round(i.cantidad * 10) / 10, i.unidad)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <AccionSuave onClick={aLaCompra}>🛒 A la compra</AccionSuave>
          {guardada && <AccionSuave onClick={() => setEligiendoDia((v) => !v)}>🗓️ Al menú</AccionSuave>}
        </div>

        {eligiendoDia && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 10, background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, padding: 10 }}>
            <p style={{ fontSize: 12.5, color: BCN.humo, margin: "0 0 8px" }}>¿Cuándo?</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
              {proximos.map((f) => (
                <FilaDia key={f} fecha={f} esHoy={f === hoy} onElegir={(m) => ponerEnMenu(f, m)} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Elaboración */}
      <div style={{ marginTop: 20 }}>
        <Etiqueta>Cómo se hace</Etiqueta>
        {r.pasos.length > 0 ? (
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {r.pasos.map((p, n) => (
              <li key={n} style={{ display: "flex", gap: 11 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", background: `${VERDE}1C`, color: VERDE, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800,
                }}>{n + 1}</span>
                <span style={{ fontSize: 14.5, color: BCN.tinta, lineHeight: 1.5 }}>{p}</span>
              </li>
            ))}
          </ol>
        ) : ocupado === "pasos" ? (
          <Pensando texto="Escribiendo los pasos" />
        ) : guardada ? (
          <BotonIA onClick={verPasos}>Ver cómo se hace</BotonIA>
        ) : (
          <p style={{ fontSize: 13, color: BCN.humo, margin: 0 }}>Guardadla y os escribo los pasos.</p>
        )}
      </div>

      {/* Inspiración */}
      <div style={{ marginTop: 20 }}>
        <Etiqueta>Verla hecha</Etiqueta>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Enlace href={buscarEnTikTok(r.nombre)}>🎵 TikTok</Enlace>
          <Enlace href={buscarEnPinterest(r.nombre)}>📌 Pinterest</Enlace>
          <Enlace href={buscarEnYouTube(r.nombre)}>▶️ YouTube</Enlace>
          {r.enlace && <Enlace href={r.enlace}>🔗 La original</Enlace>}
        </div>
      </div>

      {/* Acciones finales */}
      <div style={{ marginTop: 22 }}>
        {!guardada ? (
          <BotonIA onClick={guardar} disabled={ocupado === "guardar"}>
            {ocupado === "guardar" ? "Guardando…" : "Guardar en el recetario"}
          </BotonIA>
        ) : (
          <button onClick={borrar}
            style={{ width: "100%", padding: 10, background: "none", border: "none", color: BCN.humo, fontSize: 13, cursor: "pointer" }}>
            Borrar del recetario
          </button>
        )}
      </div>

      {/* Mensajito flotante */}
      {aviso && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: "sticky", bottom: 0, marginTop: 12, padding: "11px 14px", borderRadius: 14,
            background: BCN.tinta, color: "white", fontSize: 13.5, textAlign: "center",
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
          }}>
          {aviso}
        </motion.div>
      )}
    </Hoja>
  );
}

/* ─── Piezas ───────────────────────────────────────────────── */

function Chip({ children, color = BCN.humo }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ padding: "4px 10px", borderRadius: 14, background: `${color}14`, color, fontSize: 12, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function Paso({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${BCN.arenaOsc}`, background: "white", fontSize: 16, color: BCN.tinta, cursor: "pointer", lineHeight: 1 }}>
      {children}
    </motion.button>
  );
}

function AccionSuave({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{
        flex: 1, padding: "11px 8px", borderRadius: 12, cursor: "pointer",
        border: `1px solid ${VERDE}55`, background: `${VERDE}0E`, color: VERDE, fontSize: 13.5, fontWeight: 700,
      }}>
      {children}
    </motion.button>
  );
}

function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{
        padding: "8px 12px", borderRadius: 18, border: `1px solid ${BCN.arenaOsc}`, background: "white",
        color: BCN.tinta, fontSize: 13, fontWeight: 600, textDecoration: "none",
      }}>
      {children}
    </a>
  );
}

function FilaDia({ fecha, esHoy, onElegir }: { fecha: string; esHoy: boolean; onElegir: (m: Momento) => void }) {
  return (
    <>
      <span style={{ fontSize: 13.5, color: esHoy ? BCN.teja : BCN.tinta, fontWeight: esHoy ? 700 : 500 }}>
        {esHoy ? "Hoy" : fechaCorta(fecha)}
      </span>
      {(Object.keys(MOMENTOS) as Momento[]).map((m) => (
        <button key={m} onClick={() => onElegir(m)}
          style={{
            padding: "6px 10px", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, background: BCN.arena,
            fontSize: 12.5, color: BCN.tinta, cursor: "pointer",
          }}>
          {MOMENTOS[m].icon} {MOMENTOS[m].label}
        </button>
      ))}
    </>
  );
}
