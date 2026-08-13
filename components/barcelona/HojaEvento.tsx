"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  BCN, TIPO_MOMENTO, pintarMomento,
  type Momento, type TipoMomento, type Barrio, type Autor, type Contacto,
} from "@/lib/barcelona/types";
import { updateMomento, deleteMomento, formatFechaLarga, nombreDia } from "@/lib/barcelona/queries";
import { subirFoto } from "@/lib/upload";
import { avisar } from "@/lib/barcelona/avisar";
import { useUserStore } from "@/store/userStore";
import { Hoja, Campo, estiloInput, Selector } from "@/components/barcelona/Shell";
import { Visor, useVisor } from "@/components/barcelona/Visor";

/* ═══════════════════════════════════════════════════════════
   Ficha de un evento del calendario.

   Se abre al pulsarlo y desde aquí se hace todo: marcarlo como
   hecho, editar la hora (que nunca es la que pusiste), cambiar
   cualquier dato o borrarlo.
   ═══════════════════════════════════════════════════════════ */

const TIPOS: TipoMomento[] = [
  "explorar", "visita_piso", "restaurante", "rooftop", "playa",
  "excursion", "cita", "llegada", "mudanza", "otro",
];

export function HojaEvento({ momento, barrios, contactos = [], onCerrar, onCambio }: {
  momento: Momento | null;
  barrios: Barrio[];
  contactos?: Contacto[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const [tipo, setTipo] = useState<TipoMomento>("otro");
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [nota, setNota] = useState("");
  const [lugar, setLugar] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [contactoId, setContactoId] = useState("");
  const visor = useVisor();
  const [autor, setAutor] = useState<Autor>("ambos");
  const [esHito, setEsHito] = useState(false);
  const { activeUser } = useUserStore();
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [falloFoto, setFalloFoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Al abrir otro evento, volvemos a modo lectura y recargamos campos.
  useEffect(() => {
    if (!momento) return;
    setEditando(false);
    setConfirmarBorrado(false);
    setTipo(momento.tipo);
    setTitulo(momento.titulo);
    setFecha(momento.fecha);
    setHora(momento.hora?.slice(0, 5) ?? "");
    setNota(momento.nota ?? "");
    setLugar(momento.lugar ?? "");
    setBarrioId(momento.barrio_id ?? "");
    setContactoId(momento.contacto_id ?? "");
    setAutor(momento.autor);
    setEsHito(momento.es_hito);
    setFotos(momento.fotos ?? []);
    setFalloFoto(null);
  }, [momento]);

  if (!momento) return <Hoja abierta={false} onCerrar={onCerrar} titulo="">{null}</Hoja>;

  const cfg = pintarMomento(momento.tipo, momento.titulo);
  const vivido = momento.estado === "vivido";

  const guardar = async () => {
    if (!titulo.trim()) return;
    setGuardando(true);
    await updateMomento(momento.id, {
      tipo,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      nota: nota.trim() || null,
      lugar: lugar.trim() || null,
      barrio_id: barrioId || null,
      contacto_id: contactoId || null,
      autor,
      es_hito: esHito,
      fotos,
    });

    // Solo si se han añadido fotos que antes no estaban
    if (activeUser && fotos.length > (momento.fotos?.length ?? 0)) {
      avisar(activeUser, "fotos", momento.titulo);
    }
    setGuardando(false);
    setEditando(false);
    onCambio();
  };

  const anadirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidas = Array.from(e.target.files ?? []);
    if (elegidas.length === 0) return;

    setSubiendoFoto(true);
    setFalloFoto(null);

    const nuevas: string[] = [];
    let fallidas = 0;
    let motivo: string | null = null;

    for (const f of elegidas) {
      const r = await subirFoto(f, "barcelona");
      if (r.url) nuevas.push(r.url);
      else { fallidas++; motivo = r.error; }
    }

    setFotos((antes) => [...antes, ...nuevas]);
    if (fallidas > 0) {
      setFalloFoto(
        fallidas === elegidas.length
          ? (motivo ?? "No hemos podido subir la foto.")
          : `${fallidas} de ${elegidas.length} no han subido.`
      );
    }
    setSubiendoFoto(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const alternarHecho = async () => {
    setGuardando(true);
    await updateMomento(momento.id, { estado: vivido ? "previsto" : "vivido" });
    setGuardando(false);
    onCambio();
  };

  const borrar = async () => {
    setGuardando(true);
    await deleteMomento(momento.id);
    setGuardando(false);
    onCerrar();
    onCambio();
  };

  return (
    <Hoja abierta={!!momento} onCerrar={onCerrar} titulo={editando ? "Editar" : ""}>
      {editando ? (
        /* ══ Modo edición ══ */
        <>
          <Campo label="¿Qué es?">
            <input value={tipo} onChange={(e) => setTipo(e.target.value)}
              placeholder="Lo que sea: firma, mudanza, cena…" style={estiloInput} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {TIPOS.map((t) => {
                const c = TIPO_MOMENTO[t];
                const activo = tipo === t;
                return (
                  <button key={t} type="button" onClick={() => setTipo(activo ? "" : t)}
                    style={{
                      padding: "6px 11px", borderRadius: 16, cursor: "pointer", fontSize: 12.5,
                      border: `1px solid ${activo ? c.color : BCN.arenaOsc}`,
                      background: activo ? `${c.color}18` : "white",
                      color: activo ? c.color : BCN.humo,
                      fontWeight: activo ? 600 : 500,
                    }}>
                    {c.icon} {c.label}
                  </button>
                );
              })}
            </div>
          </Campo>

          {contactos.length > 0 && (
            <Campo label="¿Con quién?">
              <select value={contactoId} onChange={(e) => setContactoId(e.target.value)} style={estiloInput}>
                <option value="">Nadie en concreto</option>
                {contactos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>
          )}

          <Campo label="Título">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} style={estiloInput} />
          </Campo>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1.4 }}>
              <Campo label="Fecha">
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={estiloInput} />
              </Campo>
            </div>
            <div style={{ flex: 1 }}>
              <Campo label="Hora">
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={estiloInput} />
              </Campo>
            </div>
          </div>

          <Campo label="Notas">
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={4}
              style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
          </Campo>

          <Campo label="Lugar">
            <input value={lugar} onChange={(e) => setLugar(e.target.value)}
              placeholder="Dirección o nombre del sitio" style={estiloInput} />
          </Campo>

          {barrios.length > 0 && (
            <Campo label="Barrio">
              <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)} style={estiloInput}>
                <option value="">Sin barrio</option>
                {barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </Campo>
          )}

          <Campo label="¿De quién es?">
            <Selector valor={autor} onChange={setAutor} color={BCN.mar}
              opciones={[
                { valor: "ambos" as Autor,     label: "De los dos" },
                { valor: "alejandro" as Autor, label: "Alejandro" },
                { valor: "rut" as Autor,       label: "Rut" },
              ]} />
          </Campo>

          <Campo label="Fotos">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {fotos.map((url, i) => (
                <div key={url} style={{ position: "relative", width: 74, height: 74 }}>
                  <img src={url} alt="" onClick={() => visor.abrir(i)}
                    style={{
                      width: "100%", height: "100%", objectFit: "cover", borderRadius: 12,
                      border: `1px solid ${BCN.arenaOsc}`, display: "block", cursor: "zoom-in",
                    }} />
                  <button
                    onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                    aria-label="Quitar esta foto"
                    style={{
                      position: "absolute", top: -6, right: -6, width: 24, height: 24,
                      borderRadius: "50%", border: `2px solid white`, cursor: "pointer",
                      background: BCN.teja, color: "white", fontSize: 13, lineHeight: 1, padding: 0,
                    }}>
                    ×
                  </button>
                </div>
              ))}

              <button onClick={() => fileRef.current?.click()} disabled={subiendoFoto}
                style={{
                  width: 74, height: 74, borderRadius: 12, cursor: "pointer",
                  border: `1.5px dashed ${BCN.arenaOsc}`, background: "white",
                  color: BCN.humo, fontSize: 22,
                }}>
                {subiendoFoto ? "…" : "+"}
              </button>
            </div>

            <input ref={fileRef} type="file" accept="image/*" multiple onChange={anadirFotos}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />

            {falloFoto && !subiendoFoto && (
              <p style={{ fontSize: 12.5, color: BCN.teja, margin: "8px 0 0", lineHeight: 1.5 }}>
                {falloFoto}
              </p>
            )}
          </Campo>

          <button onClick={() => setEsHito(!esHito)}
            style={{
              width: "100%", marginBottom: 14, padding: "12px 15px", borderRadius: 13,
              border: `1.5px solid ${esHito ? BCN.sol : BCN.arenaOsc}`,
              background: esHito ? `${BCN.sol}16` : "white",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            }}>
            <span style={{ fontSize: 17 }}>{esHito ? "⭐" : "☆"}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: BCN.tinta }}>
              {esHito ? "Es un hito" : "Marcar como hito"}
            </span>
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditando(false)}
              style={{ flex: 1, padding: "14px", borderRadius: 13, border: `1px solid ${BCN.arenaOsc}`, background: "white", color: BCN.humo, fontSize: 15, cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={!titulo.trim() || guardando}
              style={{
                flex: 2, padding: "14px", borderRadius: 13, border: "none",
                background: titulo.trim() && !guardando ? cfg.color : BCN.arenaOsc,
                color: "white", fontSize: 15, fontWeight: 700,
                cursor: titulo.trim() && !guardando ? "pointer" : "default",
              }}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </>
      ) : (
        /* ══ Modo lectura ══ */
        <>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: -6, marginBottom: 18 }}>
            <div style={{
              width: 50, height: 50, borderRadius: 15, flexShrink: 0,
              background: `${cfg.color}18`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
            }}>
              {cfg.icon}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  {cfg.label}
                </span>
                {momento.es_hito && <span style={{ fontSize: 12 }}>⭐</span>}
                {vivido && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: BCN.oliva, background: `${BCN.oliva}18`, padding: "2px 7px", borderRadius: 6 }}>
                    ✓ HECHO
                  </span>
                )}
                {momento.autor !== "ambos" && (
                  <span style={{ fontSize: 10, color: BCN.humo, background: BCN.arena, padding: "2px 7px", borderRadius: 6 }}>
                    {momento.autor === "rut" ? "Rut" : "Alejandro"}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 21, color: BCN.tinta, margin: "5px 0 0", lineHeight: 1.25 }}>
                {momento.titulo}
              </p>
            </div>
          </div>

          <div style={{ background: BCN.arena, borderRadius: 13, padding: "12px 14px", marginBottom: 14 }}>
            <Dato icono="📅" texto={`${nombreDia(momento.fecha)}, ${formatFechaLarga(momento.fecha)}`} />
            {momento.hora && <Dato icono="🕐" texto={momento.hora.slice(0, 5)} />}
            {momento.lugar && <Dato icono="📍" texto={momento.lugar} />}
          </div>

          {momento.nota && (
            <p style={{ fontSize: 15, color: BCN.tinta, lineHeight: 1.65, margin: "0 0 16px", paddingLeft: 13, borderLeft: `3px solid ${cfg.color}44` }}>
              {momento.nota}
            </p>
          )}

          {momento.fotos.length > 0 && (
            <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
              {momento.fotos.map((url, i) => (
                <img key={url} src={url} alt="" onClick={() => visor.abrir(i)}
                  style={{ width: 96, height: 96, borderRadius: 11, objectFit: "cover", flexShrink: 0, border: `1px solid ${BCN.arenaOsc}`, cursor: "zoom-in" }} />
              ))}
            </div>
          )}

          {/* Acciones */}
          <button onClick={alternarHecho} disabled={guardando}
            style={{
              width: "100%", padding: "14px", borderRadius: 13, border: "none", marginBottom: 8,
              background: vivido ? BCN.arena : BCN.teja,
              color: vivido ? BCN.humo : "white",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {vivido ? "↩ Marcar como pendiente" : "✓ Ya lo hemos hecho"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditando(true)}
              style={{ flex: 2, padding: "13px", borderRadius: 13, border: `1px solid ${BCN.arenaOsc}`, background: "white", color: BCN.tinta, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
              ✎ Editar
            </button>

            {confirmarBorrado ? (
              <motion.button
                initial={{ scale: 0.94 }} animate={{ scale: 1 }}
                onClick={borrar} disabled={guardando}
                style={{ flex: 2, padding: "13px", borderRadius: 13, border: "none", background: "#B8392E", color: "white", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>
                ¿Seguro? Borrar
              </motion.button>
            ) : (
              <button onClick={() => setConfirmarBorrado(true)}
                style={{ flex: 1, padding: "13px", borderRadius: 13, border: `1px solid ${BCN.arenaOsc}`, background: "white", color: BCN.humo, fontSize: 14.5, cursor: "pointer" }}>
                Borrar
              </button>
            )}
          </div>
        </>
      )}
      <Visor fotos={editando ? fotos : momento.fotos} indice={visor.indice} onCerrar={visor.cerrar} />
    </Hoja>
  );
}

function Dato({ icono, texto }: { icono: string; texto: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0" }}>
      <span style={{ fontSize: 13, width: 17 }}>{icono}</span>
      <span style={{ fontSize: 14, color: BCN.tinta, textTransform: "capitalize" }}>{texto}</span>
    </div>
  );
}
