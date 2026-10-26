"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import {
  sumarDias, fechaCorta, fechaLarga, rangoSemana, diaCorto, numeroDia, getTurnos, textoTramos, type Turno,
} from "@/lib/barcelona/trabajo";
import {
  MOMENTOS, getPlan, guardarHueco, vaciarHueco, marcarHecho, nutrientesDe, pedirACocina,
  type Hueco, type Momento, type Receta,
} from "@/lib/barcelona/super";
import { Hoja, estiloInput } from "../Shell";
import { Portada, Nutri, BotonIA, Pensando, Aviso, VERDE } from "./Comun";
import { HojaPlanificar, HojaBatch, ResumenSemanal, huecosLibres, semanaDe } from "./Extras";

/* ═══════════════════════════════════════════════════════════
   El menú de la semana: comida (en tupper) y cena de cada día.
   ═══════════════════════════════════════════════════════════ */

export function TabMenu({ hoy, quien, recetas, version, onCambio, abrirReceta }: {
  hoy: string;
  quien: string;
  recetas: Receta[];
  version: number;
  onCambio: () => void;
  abrirReceta: (r: Receta) => void;
}) {
  const [lunes, setLunes] = useState(() => semanaDe(hoy).lunes);
  const [plan, setPlan] = useState<Hueco[]>([]);
  const [turnos, setTurnos] = useState<{ rut: Turno[]; alejandro: Turno[] }>({ rut: [], alejandro: [] });
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<{ fecha: string; momento: Momento } | null>(null);
  const [planificando, setPlanificando] = useState(false);
  const [batch, setBatch] = useState<{ desde: string; hasta: string } | null>(null);
  // El plato que se está cambiando con 🔄, y si ha fallado
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const dias = semanaDe(lunes).dias;
  const domingo = dias[6];

  const cargar = useCallback(async () => {
    // Hasta el lunes siguiente: la comida de ese lunes se cocina el domingo por la noche
    const [p, r, a] = await Promise.all([
      getPlan(lunes, sumarDias(domingo, 1)),
      getTurnos("rut", lunes, domingo),
      getTurnos("alejandro", lunes, domingo),
    ]);
    setPlan(p);
    setTurnos({ rut: r, alejandro: a });
    setCargando(false);
  }, [lunes, domingo]);

  useEffect(() => { cargar(); }, [cargar, version]);

  const porId = useMemo(() => new Map(recetas.map((r) => [r.id, r])), [recetas]);
  const hueco = (f: string, m: Momento) => plan.find((h) => h.fecha === f && h.momento === m) ?? null;
  const desde = lunes < hoy ? hoy : lunes;
  const libres = huecosLibres(desde, domingo, plan, hoy);
  // Lo que ya tiene plato y aún no se ha cocinado: se puede rehacer
  const ocupados = plan
    .filter((h) => h.receta_id && !h.hecho && h.fecha >= desde && h.fecha <= domingo && !(h.fecha === hoy && h.momento === "comida"))
    .map((h) => ({ fecha: h.fecha, momento: h.momento }));

  const recargar = () => { cargar(); onCambio(); };

  /** 🔄 Otra idea para un plato, al momento y sin abrir nada. */
  const otra = async (fecha: string, momento: Momento) => {
    setCambiando(`${fecha}|${momento}`);
    setFallo(null);
    const res = await pedirACocina({ accion: "plan", huecos: [{ fecha, momento }] }, quien);
    setCambiando(null);
    if (!res.ok) return setFallo(res.error);
    recargar();
  };

  return (
    <div>
      {/* Semana */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Flecha izquierda onClick={() => { setCargando(true); setLunes(sumarDias(lunes, -7)); }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: 0 }}>{rangoSemana(lunes)}</p>
          <p style={{ fontSize: 11.5, color: BCN.humo, margin: "2px 0 0", minHeight: 14 }}>
            {dias.includes(hoy) ? "Esta semana" : lunes === sumarDias(semanaDe(hoy).lunes, 7) ? "La semana que viene" : ""}
          </p>
        </div>
        <Flecha onClick={() => { setCargando(true); setLunes(sumarDias(lunes, 7)); }} />
      </div>

      {domingo >= hoy && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1.4 }}>
            <BotonIA onClick={() => setPlanificando(true)} disabled={libres.length === 0 && ocupados.length === 0}>
              {libres.length > 0 ? "Planificar la semana" : ocupados.length > 0 ? "Rehacer la semana" : "Semana completa"}
            </BotonIA>
          </div>
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => setBatch({ desde: lunes < hoy ? hoy : lunes, hasta: domingo })}
            style={{
              flex: 1, borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, background: "white",
              fontSize: 13.5, fontWeight: 700, color: BCN.tinta, cursor: "pointer",
            }}>
            🍱 Batch cooking
          </motion.button>
        </div>
      )}

      {fallo && <div style={{ marginBottom: 10 }}><Aviso>{fallo}</Aviso></div>}

      {/* Días */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={lunes} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dias.map((f) => {
            const comida = hueco(f, "comida");
            const cena = hueco(f, "cena");
            const tupperManana = hueco(sumarDias(f, 1), "comida");
            const nutri = nutrientesDe([comida, cena].filter((h): h is Hueco => !!h), recetas);
            const rCena = cena?.receta_id ? porId.get(cena.receta_id) : null;
            const rTupper = tupperManana?.receta_id ? porId.get(tupperManana.receta_id) : null;
            const minutosNoche = (rCena?.tiempo_min ?? 0) + (rTupper?.tiempo_min ?? 0);
            const esHoy = f === hoy;
            const pasado = f < hoy;
            return (
              <div key={f} style={{
                background: "white", borderRadius: 18, padding: "12px 12px 10px", opacity: pasado ? 0.7 : 1,
                border: `1.5px solid ${esHoy ? BCN.teja : BCN.arenaOsc}`,
                boxShadow: esHoy ? `0 4px 18px ${BCN.teja}22` : "0 2px 10px rgba(44,36,32,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 17, color: esHoy ? BCN.teja : BCN.tinta }}>
                    {esHoy ? "Hoy" : `${diaCorto(f)} ${numeroDia(f)}`}
                  </span>
                  {nutri.platos > 0 && nutri.sinDatos < nutri.platos && (
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: BCN.humo, fontVariantNumeric: "tabular-nums" }}>
                      ≈ {nutri.kcal} kcal · {nutri.proteinas} g prot / persona
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11.5, color: BCN.humo, margin: "0 0 8px" }}>
                  {horario("Rut", turnos.rut.find((t) => t.fecha === f))} · {horario("Ale", turnos.alejandro.find((t) => t.fecha === f))}
                </p>

                {(["comida", "cena"] as Momento[]).map((m) => {
                  const h = m === "comida" ? comida : cena;
                  // La comida de hoy ya se cocinó anoche: esa no se cambia con 🔄
                  const cambiable = !pasado && !h?.hecho && !h?.texto && !(esHoy && m === "comida");
                  return (
                    <Plato key={m} momento={m} hueco={h}
                      receta={h?.receta_id ? porId.get(h.receta_id) ?? null : null}
                      cargando={cargando}
                      cambiando={cambiando === `${f}|${m}`}
                      onOtra={cambiable && !cambiando ? () => otra(f, m) : null}
                      onTocar={() => setEditando({ fecha: f, momento: m })} />
                  );
                })}

                {!pasado && minutosNoche > 0 && (
                  <p style={{ fontSize: 11.5, color: VERDE, fontWeight: 600, margin: "6px 2px 0" }}>
                    🌙 Esta noche: {rCena ? "cena" : ""}{rCena && rTupper ? " + " : ""}{rTupper ? "tupper de mañana" : ""} · ≈ {minutosNoche} min
                  </p>
                )}
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div style={{ marginTop: 18 }}>
        <ResumenSemanal lunes={lunes} quien={quien} hayMenu={plan.some((h) => h.receta_id && h.fecha <= domingo)} />
      </div>

      <HojaHueco
        hueco={editando}
        actual={editando ? hueco(editando.fecha, editando.momento) : null}
        recetas={recetas}
        quien={quien}
        onCerrar={() => setEditando(null)}
        onCambio={recargar}
        abrirReceta={abrirReceta}
      />
      <HojaPlanificar abierta={planificando} huecos={libres} ocupados={ocupados} recetas={recetas} quien={quien} onCerrar={() => setPlanificando(false)} onHecho={recargar} />
      <HojaBatch rango={batch} quien={quien} onCerrar={() => setBatch(null)} />
    </div>
  );
}

function horario(nombre: string, t: Turno | undefined): string {
  if (!t) return `${nombre}: —`;
  if (t.tipo !== "trabajo") return `${nombre}: ${t.tipo === "libre" ? "libra" : t.tipo}`;
  return `${nombre}: ${textoTramos(t.tramos)}`;
}

/* ─── Un plato en el día ───────────────────────────────────── */

function Plato({ momento, hueco, receta, cargando, cambiando, onTocar, onOtra }: {
  momento: Momento; hueco: Hueco | null; receta: Receta | null; cargando: boolean; cambiando: boolean;
  onTocar: () => void;
  /** null = este plato no se puede cambiar con 🔄 */
  onOtra: (() => void) | null;
}) {
  const etiqueta = momento === "comida" ? "Comida · tupper" : "Cena";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <motion.button whileTap={{ scale: 0.98 }} onClick={onTocar} disabled={cambiando}
        style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "6px 4px",
          background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        }}>
        {receta && !cambiando ? (
          <div style={{ width: 50, flexShrink: 0 }}><Portada receta={receta} alto={50} radio={12} emoji={24} /></div>
        ) : (
          <div style={{
            width: 50, height: 50, borderRadius: 12, flexShrink: 0, border: `1.5px dashed ${BCN.arenaOsc}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: BCN.arena,
          }}>
            {cambiando ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block" }}>🔄</motion.span>
            ) : hueco?.texto ? "📝" : MOMENTOS[momento].icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            {etiqueta}
          </p>
          {cargando ? (
            <div style={{ height: 11, width: "60%", borderRadius: 6, background: BCN.arenaOsc, opacity: 0.6, marginTop: 5 }} />
          ) : cambiando ? (
            <p style={{ fontSize: 13.5, color: BCN.humo, margin: "1px 0 0" }}>Buscando otra idea…</p>
          ) : receta ? (
            <>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: BCN.tinta, margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {receta.fijo ? "⭐ " : ""}{receta.nombre}
              </p>
              <Nutri r={receta} />
            </>
          ) : hueco?.texto ? (
            <p style={{ fontSize: 14.5, color: BCN.tinta, margin: "1px 0 0", fontStyle: "italic" }}>{hueco.texto}</p>
          ) : (
            <p style={{ fontSize: 13.5, color: BCN.humo, margin: "1px 0 0" }}>Sin decidir · tocar para elegir</p>
          )}
        </div>
        {hueco?.hecho && <span style={{ fontSize: 15 }} title="Cocinado">✅</span>}
      </motion.button>

      {onOtra && !cargando && (
        <motion.button whileTap={{ scale: 0.85, rotate: 90 }} onClick={onOtra} aria-label="Otra idea"
          style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
            border: `1px solid ${BCN.arenaOsc}`, background: "white", fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {receta ? "🔄" : "✨"}
        </motion.button>
      )}
    </div>
  );
}

/* ─── Editar un hueco ──────────────────────────────────────── */

const TEXTOS_LIBRES = ["Fuera de casa", "Sobras", "Libre", "Cena con amigos"];

function HojaHueco({ hueco, actual, recetas, quien, onCerrar, onCambio, abrirReceta }: {
  hueco: { fecha: string; momento: Momento } | null;
  actual: Hueco | null;
  recetas: Receta[];
  quien: string;
  onCerrar: () => void;
  onCambio: () => void;
  abrirReceta: (r: Receta) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [eligiendo, setEligiendo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setBusqueda(""); setEligiendo(false); setError(null); setPensando(false); }, [hueco?.fecha, hueco?.momento]);

  const receta = actual?.receta_id ? recetas.find((r) => r.id === actual.receta_id) ?? null : null;
  const visibles = recetas
    .filter((r) => r.valoracion !== "nunca")
    .filter((r) => !busqueda.trim() || r.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .sort((a, b) => (a.valoracion === "encanta" ? -1 : 0) - (b.valoracion === "encanta" ? -1 : 0))
    .slice(0, 40);

  const poner = async (datos: { receta_id: string | null; texto: string | null }) => {
    if (!hueco) return;
    const ok = await guardarHueco(hueco.fecha, hueco.momento, datos);
    if (!ok) return setError("No se ha podido guardar.");
    onCambio();
    onCerrar();
  };

  const decideIA = async () => {
    if (!hueco) return;
    setPensando(true);
    setError(null);
    const res = await pedirACocina({ accion: "plan", huecos: [hueco] }, quien);
    setPensando(false);
    if (!res.ok) return setError(res.error);
    onCambio();
    onCerrar();
  };

  const quitar = async () => {
    if (!hueco) return;
    await vaciarHueco(hueco.fecha, hueco.momento);
    onCambio();
    onCerrar();
  };

  const alternarHecho = async () => {
    if (!actual) return;
    await marcarHecho(actual, receta, !actual.hecho);
    onCambio();
    onCerrar();
  };

  const titulo = hueco ? `${MOMENTOS[hueco.momento].icon} ${MOMENTOS[hueco.momento].label} · ${fechaLarga(hueco.fecha)}` : "";

  return (
    <Hoja abierta={hueco !== null} onCerrar={onCerrar} titulo={titulo}>
      {pensando ? (
        <Pensando texto="Eligiendo algo rico" />
      ) : (
        <>
          {hueco?.momento === "comida" && (
            <p style={{ fontSize: 12.5, color: BCN.humo, margin: "-10px 0 12px" }}>
              Se cocina la noche del {fechaCorta(sumarDias(hueco.fecha, -1))} y va en tupper.
            </p>
          )}

          {receta && (
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => { onCerrar(); abrirReceta(receta); }}
              style={{
                width: "100%", display: "flex", gap: 12, alignItems: "center", padding: 10, borderRadius: 16, marginBottom: 12,
                border: `1px solid ${BCN.arenaOsc}`, background: "white", cursor: "pointer", textAlign: "left",
              }}>
              <div style={{ width: 64 }}><Portada receta={receta} alto={64} radio={12} emoji={30} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: BCN.tinta, margin: 0 }}>{receta.nombre}</p>
                <Nutri r={receta} />
                <p style={{ fontSize: 12, color: VERDE, fontWeight: 600, margin: "3px 0 0" }}>Ver la receta ›</p>
              </div>
            </motion.button>
          )}

          {actual && (actual.receta_id || actual.texto) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <BotonPeque onClick={alternarHecho}>{actual.hecho ? "↩︎ No hecho" : "✅ Hecho"}</BotonPeque>
              <BotonPeque onClick={quitar}>🗑 Quitar</BotonPeque>
            </div>
          )}

          {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}

          <BotonIA onClick={decideIA}>Que lo decida la IA</BotonIA>

          <div style={{ marginTop: 14 }}>
            {!eligiendo ? (
              <BotonPeque ancho onClick={() => setEligiendo(true)}>📖 Elegir del recetario ({recetas.filter((r) => r.valoracion !== "nunca").length})</BotonPeque>
            ) : (
              <>
                <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" style={{ ...estiloInput, marginBottom: 8 }} />
                <div style={{ maxHeight: 260, overflowY: "auto", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, background: "white" }}>
                  {visibles.length === 0 && <p style={{ fontSize: 13, color: BCN.humo, padding: 14, margin: 0 }}>Nada por aquí todavía.</p>}
                  {visibles.map((r, i) => (
                    <button key={r.id} onClick={() => poner({ receta_id: r.id, texto: null })}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "none",
                        borderBottom: i === visibles.length - 1 ? "none" : `1px solid ${BCN.arena}`, background: "white", cursor: "pointer", textAlign: "left",
                      }}>
                      <div style={{ width: 38 }}><Portada receta={r} alto={38} radio={9} emoji={18} /></div>
                      <span style={{ flex: 1, fontSize: 14, color: BCN.tinta }}>{r.nombre}</span>
                      {r.valoracion === "encanta" && <span>❤️</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {TEXTOS_LIBRES.map((t) => (
              <button key={t} onClick={() => poner({ receta_id: null, texto: t })}
                style={{ padding: "7px 12px", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, background: "white", fontSize: 13, color: BCN.tinta, cursor: "pointer" }}>
                📝 {t}
              </button>
            ))}
          </div>
        </>
      )}
    </Hoja>
  );
}

function BotonPeque({ children, onClick, ancho = false }: { children: React.ReactNode; onClick: () => void; ancho?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{
        flex: ancho ? undefined : 1, width: ancho ? "100%" : undefined, padding: "11px 10px", borderRadius: 12, cursor: "pointer",
        border: `1px solid ${BCN.arenaOsc}`, background: "white", color: BCN.tinta, fontSize: 13.5, fontWeight: 600,
      }}>
      {children}
    </motion.button>
  );
}

export function Flecha({ izquierda = false, onClick }: { izquierda?: boolean; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} aria-label={izquierda ? "Anterior" : "Siguiente"}
      style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
        background: "white", border: `1px solid ${BCN.arenaOsc}`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: izquierda ? "none" : "rotate(180deg)" }}>
        <path d="M15 18l-6-6 6-6" stroke={BCN.tinta} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}
