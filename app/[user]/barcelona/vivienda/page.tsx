"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import {
  BCN, EJES, ESTADO_PISO,
  type Piso, type Barrio, type Etapa, type Valoracion, type EstadoPiso, type EjeKey,
} from "@/lib/barcelona/types";
import { calcularCompatibilidad, fraseCompat, colorCompat, LECTURA } from "@/lib/barcelona/compat";
import {
  getEtapaActiva, getPisos, getBarrios, getValoraciones,
  addPiso, updatePiso, deletePiso, upsertValoracion,
} from "@/lib/barcelona/queries";
import { Pantalla, Vacio, Hoja, Campo, estiloInput, Boton, Selector, IconoMas } from "@/components/barcelona/Shell";

const ESTADOS: EstadoPiso[] = ["nuevo", "contactado", "visitado", "favorito", "descartado", "elegido"];

export default function ViviendaPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [valoraciones, setValoraciones] = useState<Valoracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<EstadoPiso | "todos">("todos");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [valorando, setValorando] = useState<Piso | null>(null);
  const [enlaceEntrante, setEnlaceEntrante] = useState<string | null>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  // El marcador del ordenador y el Atajo del iPhone nos mandan aquí con
  // ?piso=<enlace>. Abrimos el formulario ya leyéndolo y quitamos el
  // parámetro de la barra, para que al recargar no se repita.
  useEffect(() => {
    const entrante = new URLSearchParams(window.location.search).get("piso");
    if (!entrante) return;
    setEnlaceEntrante(entrante);
    setAnadiendo(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);
    const [p, b, v] = await Promise.all([getPisos(e.id), getBarrios(e.id), getValoraciones(e.id, "piso")]);
    setPisos(p); setBarrios(b); setValoraciones(v);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = filtro === "todos" ? pisos : pisos.filter((p) => p.estado === filtro);

  return (
    <Pantalla
      titulo="Vivienda"
      subtitulo={pisos.length > 0 ? `${pisos.length} ${pisos.length === 1 ? "piso" : "pisos"} · cada uno, una decisión` : "Cada piso es una decisión"}
      color={BCN.tejaOsc}
      accion={{ icon: IconoMas, label: "Añadir piso", onClick: () => setAnadiendo(true) }}
    >
      {cargando ? (
        <Cargando />
      ) : pisos.length === 0 ? (
        <>
          <Vacio
            icon="🏠"
            titulo="Todavía no hay pisos"
            texto="Añadidlos a mano por ahora. Cuando conectemos la extensión de Chrome, entrarán solos desde Idealista y Fotocasa."
            accion={{ label: "Añadir un piso", onClick: () => setAnadiendo(true) }}
          />
          <Ecosistema />
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Selector
              valor={filtro}
              onChange={setFiltro}
              color={BCN.tejaOsc}
              opciones={[
                { valor: "todos" as const, label: `Todos (${pisos.length})` },
                ...ESTADOS.filter((e) => pisos.some((p) => p.estado === e)).map((e) => ({
                  valor: e,
                  label: `${ESTADO_PISO[e].label} (${pisos.filter((p) => p.estado === e).length})`,
                  icon: ESTADO_PISO[e].icon,
                })),
              ]}
            />
          </div>

          {visibles.map((p, i) => (
            <TarjetaPiso
              key={p.id}
              piso={p}
              barrio={barrios.find((b) => b.id === p.barrio_id) ?? null}
              compat={calcularCompatibilidad(valoraciones.filter((v) => v.entidad_id === p.id))}
              delay={i * 0.04}
              expandido={expandido === p.id}
              onToggle={() => setExpandido(expandido === p.id ? null : p.id)}
              onEstado={async (estado) => { await updatePiso(p.id, { estado }); await cargar(); }}
              onValorar={() => setValorando(p)}
              onBorrar={async () => { await deletePiso(p.id); await cargar(); }}
              onPortada={async (indice) => {
                const fotos = [p.fotos[indice], ...p.fotos.filter((_, j) => j !== indice)];
                await updatePiso(p.id, { fotos });
                await cargar();
              }}
              onQuitarFoto={async (indice) => {
                await updatePiso(p.id, { fotos: p.fotos.filter((_, j) => j !== indice) });
                await cargar();
              }}
            />
          ))}

          {visibles.length === 0 && (
            <p style={{ textAlign: "center", color: BCN.humo, fontSize: 14, padding: "36px 0" }}>
              Ningún piso en este estado.
            </p>
          )}
        </>
      )}

      <HojaAnadir
        abierta={anadiendo}
        etapaId={etapa?.id ?? null}
        barrios={barrios}
        enlaceEntrante={enlaceEntrante}
        onCerrar={() => { setAnadiendo(false); setEnlaceEntrante(null); }}
        onGuardado={async () => { setAnadiendo(false); setEnlaceEntrante(null); await cargar(); }}
      />

      <HojaValorarPiso
        piso={valorando}
        etapaId={etapa?.id ?? null}
        usuario={user}
        actual={valoraciones.find((v) => v.entidad_id === valorando?.id && v.usuario === user) ?? null}
        onCerrar={() => setValorando(null)}
        onGuardado={async () => { setValorando(null); await cargar(); }}
      />
    </Pantalla>
  );
}

/* ─── Tarjeta ──────────────────────────────────────────────── */

function TarjetaPiso({ piso, barrio, compat, delay, expandido, onToggle, onEstado, onValorar, onBorrar, onPortada, onQuitarFoto }: {
  piso: Piso; barrio: Barrio | null; compat: ReturnType<typeof calcularCompatibilidad>;
  delay: number; expandido: boolean;
  onToggle: () => void; onEstado: (e: EstadoPiso) => void; onValorar: () => void; onBorrar: () => void;
  onPortada: (indice: number) => void; onQuitarFoto: (indice: number) => void;
}) {
  const cfg = ESTADO_PISO[piso.estado];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}
      style={{
        background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 18,
        marginBottom: 10, overflow: "hidden",
        boxShadow: expandido ? "0 6px 22px rgba(44,36,32,0.09)" : "0 2px 8px rgba(44,36,32,0.04)",
      }}
    >
      <button onClick={onToggle}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {piso.fotos.length > 0 && (
          <div style={{ height: 150, overflow: "hidden", position: "relative" }}>
            <img src={piso.fotos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", top: 10, right: 10, padding: "4px 10px", borderRadius: 14, background: "rgba(255,255,255,0.94)", fontSize: 11.5, fontWeight: 700, color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </div>
          </div>
        )}

        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {piso.fotos.length === 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 800, color: cfg.color, background: `${cfg.color}16`, padding: "2px 7px", borderRadius: 5 }}>
                  {cfg.icon} {cfg.label}
                </span>
              )}
              <p style={{ fontSize: 15.5, fontWeight: 600, color: BCN.tinta, margin: piso.fotos.length === 0 ? "6px 0 0" : 0, lineHeight: 1.3 }}>
                {piso.titulo}
              </p>
              <p style={{ fontSize: 13, color: BCN.humo, margin: "4px 0 0" }}>
                {[
                  piso.precio ? `${piso.precio}€/mes` : null,
                  piso.m2 ? `${piso.m2} m²` : null,
                  piso.habitaciones ? `${piso.habitaciones} hab` : null,
                  barrio?.nombre,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            {compat.porcentaje !== null && (
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 22, color: colorCompat(compat.porcentaje), margin: 0, lineHeight: 1 }}>
                  {compat.porcentaje}<span style={{ fontSize: 13 }}>%</span>
                </p>
                <p style={{ fontSize: 9, color: BCN.humo, margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  compatible
                </p>
              </div>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${BCN.arena}` }}>
              {piso.fotos.length > 1 && (
                <>
                  <p style={{ fontSize: 11.5, color: BCN.humo, margin: "12px 0 7px", lineHeight: 1.45 }}>
                    Tocad una para ponerla de portada. La × la quita, por si es
                    un cartel o el plano del portal.
                  </p>
                  <div style={{
                    display: "flex", gap: 7, overflowX: "auto", margin: "0 -16px",
                    padding: "0 16px 6px", scrollSnapType: "x mandatory",
                  }}>
                    {piso.fotos.map((foto, i) => (
                      <div key={foto} style={{ position: "relative", flexShrink: 0, scrollSnapAlign: "start" }}>
                        <button onClick={() => onPortada(i)} aria-label={`Poner la foto ${i + 1} de portada`}
                          style={{ padding: 0, border: "none", background: "none", cursor: "pointer", display: "block" }}>
                          <img src={foto} alt="" loading="lazy"
                            style={{
                              width: 128, height: 96, objectFit: "cover", borderRadius: 10,
                              border: i === 0 ? `2.5px solid ${BCN.teja}` : `1px solid ${BCN.arenaOsc}`,
                              display: "block", background: BCN.arena,
                            }} />
                        </button>
                        {i === 0 && (
                          <span style={{
                            position: "absolute", bottom: 6, left: 6, padding: "2px 7px",
                            borderRadius: 6, background: BCN.teja, color: "white",
                            fontSize: 9.5, fontWeight: 700,
                          }}>
                            Portada
                          </span>
                        )}
                        <button onClick={() => onQuitarFoto(i)} aria-label="Quitar esta foto"
                          style={{
                            position: "absolute", top: 5, right: 5, width: 22, height: 22,
                            borderRadius: "50%", border: "none", cursor: "pointer",
                            background: "rgba(0,0,0,0.55)", color: "white",
                            fontSize: 13, lineHeight: 1, padding: 0,
                          }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(piso.banos || piso.planta || piso.ascensor !== null || piso.amueblado !== null || piso.exterior !== null) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {piso.banos ? <Detalle>{piso.banos} {piso.banos === 1 ? "baño" : "baños"}</Detalle> : null}
                  {piso.planta ? <Detalle>Planta {piso.planta}</Detalle> : null}
                  {piso.ascensor !== null ? <Detalle si={piso.ascensor}>{piso.ascensor ? "Con ascensor" : "Sin ascensor"}</Detalle> : null}
                  {piso.amueblado !== null ? <Detalle si={piso.amueblado}>{piso.amueblado ? "Amueblado" : "Sin amueblar"}</Detalle> : null}
                  {piso.exterior !== null ? <Detalle si={piso.exterior}>{piso.exterior ? "Exterior" : "Interior"}</Detalle> : null}
                  {piso.precio && piso.m2 ? <Detalle>{Math.round(piso.precio / piso.m2)} €/m²</Detalle> : null}
                </div>
              )}

              {piso.descripcion && (
                <p style={{ fontSize: 13.5, color: BCN.tinta, margin: "12px 0 0", lineHeight: 1.55 }}>{piso.descripcion}</p>
              )}
              {piso.direccion && (
                <p style={{ fontSize: 12.5, color: BCN.humo, margin: "8px 0 0" }}>📍 {piso.direccion}</p>
              )}

              {compat.porcentaje !== null && (
                <div style={{ marginTop: 13, padding: "11px 13px", borderRadius: 11, background: BCN.arena, borderLeft: `3px solid ${LECTURA[compat.estado].color}` }}>
                  <p style={{ fontSize: 13, color: BCN.tinta, margin: 0, lineHeight: 1.5 }}>
                    {fraseCompat(compat, piso.titulo)}
                  </p>
                </div>
              )}

              {piso.url && (
                <a href={piso.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", marginTop: 12, padding: "10px", borderRadius: 11, background: BCN.arena, border: `1px solid ${BCN.arenaOsc}`, color: BCN.mar, fontSize: 13, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
                  Ver el anuncio original ↗
                </a>
              )}

              <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.1em", margin: "16px 0 8px" }}>
                Estado
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ESTADOS.map((e) => (
                  <button key={e} onClick={() => onEstado(e)}
                    style={{
                      padding: "7px 12px", borderRadius: 16, fontSize: 12,
                      border: `1px solid ${piso.estado === e ? ESTADO_PISO[e].color : BCN.arenaOsc}`,
                      background: piso.estado === e ? ESTADO_PISO[e].color : "white",
                      color: piso.estado === e ? "white" : BCN.tinta,
                      fontWeight: piso.estado === e ? 700 : 500, cursor: "pointer",
                    }}>
                    {ESTADO_PISO[e].icon} {ESTADO_PISO[e].label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button onClick={onValorar}
                  style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: BCN.tejaOsc, color: "white", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  {compat.faltan.length === 2 ? "Valorar" : "Actualizar valoración"}
                </button>
                <button onClick={onBorrar}
                  style={{ padding: "11px 15px", borderRadius: 12, border: `1px solid ${BCN.arenaOsc}`, background: "white", color: BCN.humo, fontSize: 13.5, cursor: "pointer" }}>
                  Borrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Ecosistema futuro ────────────────────────────────────── */

function Ecosistema() {
  const pasos = ["Idealista", "Fotocasa", "Extensión Chrome", "R&A"];
  return (
    <div style={{ marginTop: 10, padding: "20px 18px", borderRadius: 18, background: "white", border: `1px dashed ${BCN.arenaOsc}` }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 14px", textAlign: "center" }}>
        Próximamente
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        {pasos.map((p, i) => (
          <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              padding: "7px 16px", borderRadius: 18, fontSize: 13,
              background: i === pasos.length - 1 ? BCN.tejaOsc : BCN.arena,
              color: i === pasos.length - 1 ? "white" : BCN.tinta,
              fontWeight: i === pasos.length - 1 ? 700 : 500,
              border: `1px solid ${i === pasos.length - 1 ? BCN.tejaOsc : BCN.arenaOsc}`,
            }}>
              {p}
            </div>
            {i < pasos.length - 1 && <span style={{ color: BCN.arenaOsc, fontSize: 14 }}>↓</span>}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: BCN.humo, margin: "14px 0 0", textAlign: "center", lineHeight: 1.55 }}>
        Cada anuncio entrará aquí convertido en una ficha viva, lista para valorar entre los dos.
      </p>
    </div>
  );
}

/* ─── Hojas ────────────────────────────────────────────────── */

function HojaAnadir({ abierta, etapaId, barrios, enlaceEntrante, onCerrar, onGuardado }: {
  abierta: boolean; etapaId: string | null; barrios: Barrio[];
  enlaceEntrante?: string | null;
  onCerrar: () => void; onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [precio, setPrecio] = useState("");
  const [m2, setM2] = useState("");
  const [hab, setHab] = useState("");
  const [banos, setBanos] = useState("");
  const [planta, setPlanta] = useState("");
  const [ascensor, setAscensor] = useState<boolean | null>(null);
  const [amueblado, setAmueblado] = useState<boolean | null>(null);
  const [exterior, setExterior] = useState<boolean | null>(null);
  const [direccion, setDireccion] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Lo que trae el lector y no se enseña: de dónde viene y las fotos.
  const [extra, setExtra] = useState<Partial<Piso>>({});
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [leido, setLeido] = useState(false);

  /** Pega el enlace y que la app rellene lo que pueda. */
  const leer = async (forzado?: string) => {
    const enlace = (forzado ?? url).trim();
    if (!enlace || leyendo) return;
    setLeyendo(true);
    setAviso(null);

    try {
      const res = await fetch("/api/barcelona/leer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: enlace }),
      });
      const datos = await res.json();
      const a = datos?.anuncio;

      if (!a) {
        setAviso("No hemos podido abrir ese enlace. Puedes rellenarlo a mano.");
        return;
      }

      if (a.url) setUrl(a.url);
      if (a.titulo) setTitulo(a.titulo);
      if (a.precio) setPrecio(String(a.precio));
      if (a.m2) setM2(String(a.m2));
      if (a.habitaciones !== null) setHab(String(a.habitaciones));
      if (a.banos !== null) setBanos(String(a.banos));
      if (a.planta) setPlanta(a.planta);
      if (a.ascensor !== null) setAscensor(a.ascensor);
      if (a.amueblado !== null) setAmueblado(a.amueblado);
      if (a.exterior !== null) setExterior(a.exterior);
      if (a.direccion) setDireccion(a.direccion);
      if (a.descripcion && !descripcion) setDescripcion(a.descripcion);

      // El barrio viene por nombre; lo cruzamos con los vuestros
      if (a.barrio) {
        const suyo = barrios.find(
          (b) =>
            b.nombre.toLowerCase() === a.barrio.toLowerCase() ||
            a.barrio.toLowerCase().includes(b.nombre.toLowerCase()) ||
            b.nombre.toLowerCase().includes(a.barrio.toLowerCase())
        );
        if (suyo) setBarrioId(suyo.id);
      }

      setExtra({
        portal: a.portal ?? null,
        portal_id: a.portal_id ?? null,
        fotos: Array.isArray(a.fotos) ? a.fotos : [],
      });

      setLeido(true);
      setAviso(datos.ok ? null : (datos.motivo ?? null));
    } catch {
      setAviso("No hemos podido conectar. Puedes rellenarlo a mano.");
    } finally {
      setLeyendo(false);
    }
  };

  const limpiar = () => {
    setTitulo(""); setUrl(""); setPrecio(""); setM2(""); setHab("");
    setBanos(""); setPlanta(""); setAscensor(null); setAmueblado(null); setExterior(null);
    setDireccion(""); setBarrioId(""); setDescripcion("");
    setExtra({}); setAviso(null); setLeido(false);
  };

  // Si venimos del marcador del ordenador o del Atajo del móvil, el enlace
  // ya viene puesto: lo leemos solo, sin que nadie toque nada.
  const yaLanzado = useRef<string | null>(null);
  useEffect(() => {
    if (!abierta || !enlaceEntrante || yaLanzado.current === enlaceEntrante) return;
    yaLanzado.current = enlaceEntrante;
    setUrl(enlaceEntrante);
    leer(enlaceEntrante);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, enlaceEntrante]);

  const guardar = async () => {
    if (!etapaId || !titulo.trim()) return;
    setGuardando(true);
    await addPiso(etapaId, {
      titulo: titulo.trim(),
      url: url.trim() || null,
      portal:
        extra.portal ??
        (url.includes("idealista") ? "idealista" : url.includes("fotocasa") ? "fotocasa" : "manual"),
      precio: precio ? Number(precio) : null,
      m2: m2 ? Number(m2) : null,
      habitaciones: hab ? Number(hab) : null,
      direccion: direccion.trim() || null,
      barrio_id: barrioId || null,
      descripcion: descripcion.trim() || null,
      estado: "nuevo",
      portal_id: extra.portal_id ?? null,
      banos: banos ? Number(banos) : null,
      planta: planta.trim() || null,
      ascensor,
      amueblado,
      exterior,
      fotos: extra.fotos ?? [],
    });
    limpiar();
    setGuardando(false);
    onGuardado();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Añadir un piso">
      <Campo label="Enlace del anuncio">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setLeido(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") leer(); }}
            placeholder="Pega aquí el enlace…"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            style={{ ...estiloInput, flex: 1, minWidth: 0 }}
          />
          <button
            onClick={() => leer()}
            disabled={!url.trim() || leyendo}
            style={{
              padding: "0 16px", borderRadius: 12, border: "none", flexShrink: 0,
              background: url.trim() && !leyendo ? BCN.teja : BCN.arenaOsc,
              color: url.trim() && !leyendo ? "white" : BCN.humo,
              fontSize: 14, fontWeight: 600,
              cursor: url.trim() && !leyendo ? "pointer" : "default",
            }}
          >
            {leyendo ? "Leyendo…" : "Leer"}
          </button>
        </div>
      </Campo>

      {leido && !aviso && (
        <p style={{ fontSize: 12.5, color: BCN.oliva, margin: "-6px 0 14px", lineHeight: 1.5 }}>
          Anuncio leído. Repasad que esté todo bien antes de guardar.
        </p>
      )}
      {aviso && (
        <p style={{ fontSize: 12.5, color: BCN.humo, margin: "-6px 0 14px", lineHeight: 1.5 }}>
          {aviso} Rellenad lo que falte y se guarda igual.
        </p>
      )}

      <Campo label="Título">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ático en Sant Antoni" style={estiloInput} />
      </Campo>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="€/mes">
          <input type="number" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value)} style={estiloInput} />
        </Campo></div>
        <div style={{ flex: 1 }}><Campo label="m²">
          <input type="number" inputMode="numeric" value={m2} onChange={(e) => setM2(e.target.value)} style={estiloInput} />
        </Campo></div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Habitaciones">
          <input type="number" inputMode="numeric" value={hab} onChange={(e) => setHab(e.target.value)} style={estiloInput} />
        </Campo></div>
        <div style={{ flex: 1 }}><Campo label="Baños">
          <input type="number" inputMode="numeric" value={banos} onChange={(e) => setBanos(e.target.value)} style={estiloInput} />
        </Campo></div>
        <div style={{ flex: 1 }}><Campo label="Planta">
          <input value={planta} onChange={(e) => setPlanta(e.target.value)} placeholder="3ª" style={estiloInput} />
        </Campo></div>
      </div>

      <Campo label="Cómo es">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Interruptor etiqueta="Ascensor" valor={ascensor} onCambio={setAscensor} />
          <Interruptor etiqueta="Amueblado" valor={amueblado} onCambio={setAmueblado} />
          <Interruptor etiqueta="Exterior" valor={exterior} onCambio={setExterior} />
        </div>
      </Campo>
      <Campo label="Dirección">
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Carrer de…" style={estiloInput} />
      </Campo>
      {barrios.length > 0 && (
        <Campo label="Barrio">
          <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)} style={estiloInput}>
            <option value="">Sin asignar</option>
            {barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
      )}
      <Campo label="Notas">
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
          placeholder="Lo que os llama la atención…" style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>
      <Boton onClick={guardar} disabled={!titulo.trim() || guardando} color={BCN.tejaOsc}>
        {guardando ? "Guardando…" : "Guardar piso"}
      </Boton>
    </Hoja>
  );
}

/** Un dato suelto del piso. En verde lo que suma, apagado lo que resta. */
function Detalle({ children, si }: { children: React.ReactNode; si?: boolean }) {
  const color = si === undefined ? BCN.humo : si ? BCN.oliva : BCN.humo;
  return (
    <span style={{
      fontSize: 12, padding: "5px 10px", borderRadius: 8,
      background: si ? `${BCN.oliva}14` : BCN.arena,
      color, fontWeight: si ? 600 : 500,
    }}>
      {children}
    </span>
  );
}

/**
 * Sí / No / no lo sabemos. Tres estados, porque «no lo pone en el anuncio»
 * no es lo mismo que «no tiene». Se toca para ir cambiando.
 */
function Interruptor({ etiqueta, valor, onCambio }: {
  etiqueta: string; valor: boolean | null; onCambio: (v: boolean | null) => void;
}) {
  const siguiente = valor === null ? true : valor ? false : null;
  const color = valor === null ? BCN.humo : valor ? BCN.oliva : BCN.teja;

  return (
    <button
      type="button"
      onClick={() => onCambio(siguiente)}
      aria-label={`${etiqueta}: ${valor === null ? "sin saber" : valor ? "sí" : "no"}`}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "9px 14px", borderRadius: 11, cursor: "pointer",
        border: `1.5px ${valor === null ? "dashed" : "solid"} ${color}`,
        background: valor === null ? "transparent" : `${color}18`,
        color: valor === null ? BCN.humo : color,
        fontSize: 13.5, fontWeight: valor === null ? 500 : 600,
      }}
    >
      {etiqueta}
      <span style={{ fontSize: 12, opacity: 0.9 }}>
        {valor === null ? "—" : valor ? "sí" : "no"}
      </span>
    </button>
  );
}

function HojaValorarPiso({ piso, etapaId, usuario, actual, onCerrar, onGuardado }: {
  piso: Piso | null; etapaId: string | null; usuario: UserName;
  actual: Valoracion | null; onCerrar: () => void; onGuardado: () => void;
}) {
  const [valores, setValores] = useState<Record<EjeKey, number>>({ transporte: 5, ambiente: 5, precio: 5, sensacion: 5 });
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!piso) return;
    setValores({
      transporte: actual?.transporte ?? 5,
      ambiente:   actual?.ambiente   ?? 5,
      precio:     actual?.precio     ?? 5,
      sensacion:  actual?.sensacion  ?? 5,
    });
    setNota(actual?.nota ?? "");
  }, [piso, actual]);

  const guardar = async () => {
    if (!piso || !etapaId) return;
    setGuardando(true);
    await upsertValoracion(etapaId, "piso", piso.id, usuario, { ...valores, nota: nota.trim() });
    setGuardando(false);
    onGuardado();
  };

  return (
    <Hoja abierta={!!piso} onCerrar={onCerrar} titulo={piso ? `¿Qué te parece?` : ""}>
      <p style={{ fontSize: 13, color: BCN.humo, margin: "-10px 0 20px", lineHeight: 1.5 }}>
        <strong style={{ color: BCN.tinta }}>{piso?.titulo}</strong> · tu valoración, {usuario === "alejandro" ? "Alejandro" : "Rut"}.
      </p>

      {EJES.map((e) => (
        <div key={e.key} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 15, marginRight: 7 }}>{e.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: BCN.tinta }}>{e.label}</span>
            <span style={{ marginLeft: "auto", fontFamily: "Georgia, serif", fontSize: 19, color: BCN.tejaOsc }}>
              {valores[e.key]}
            </span>
          </div>
          <input type="range" min={1} max={10} step={1} value={valores[e.key]}
            onChange={(ev) => setValores({ ...valores, [e.key]: Number(ev.target.value) })}
            style={{ width: "100%", accentColor: BCN.tejaOsc, height: 26 }} />
        </div>
      ))}

      <Campo label="¿Algo que añadir?">
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3}
          placeholder="La cocina es diminuta pero la luz…" style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>

      <Boton onClick={guardar} disabled={guardando} color={BCN.tejaOsc}>
        {guardando ? "Guardando…" : "Guardar valoración"}
      </Boton>
    </Hoja>
  );
}

function Cargando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 96, borderRadius: 18, background: BCN.arenaOsc }} />
      ))}
    </div>
  );
}
