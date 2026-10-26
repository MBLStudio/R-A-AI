"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { diasDeSemana, fechaCorta, lunesDe, sumarDias } from "@/lib/barcelona/trabajo";
import {
  ACTIVIDAD, EQUIPOS, MOMENTOS, necesidades, parteComidaYCena, guardarPerfil, guardarEquipos, pedirACocina,
  type Actividad, type Equipo, type Hueco, type Momento, type Perfil, type ResumenSemana, type SesionBatch,
} from "@/lib/barcelona/super";
import { Hoja, Campo, Boton, estiloInput } from "../Shell";
import { BotonIA, Pensando, Aviso, Etiqueta, VERDE } from "./Comun";

/* ═══════════════════════════════════════════════════════════
   Lo que comparten varias pestañas: rellenar el menú con la IA,
   el batch cooking, el resumen de la semana y los ajustes.
   ═══════════════════════════════════════════════════════════ */

/* ─── Huecos del menú ──────────────────────────────────────── */

/**
 * Los huecos sin plato entre dos fechas. La comida de hoy no cuenta:
 * se cocinó anoche. Lo pasado, tampoco.
 */
export function huecosLibres(desde: string, hasta: string, plan: Hueco[], hoy: string): { fecha: string; momento: Momento }[] {
  const libres: { fecha: string; momento: Momento }[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (f < hoy) continue;
    for (const m of Object.keys(MOMENTOS) as Momento[]) {
      if (f === hoy && m === "comida") continue;
      const h = plan.find((x) => x.fecha === f && x.momento === m);
      if (!h || (!h.receta_id && !h.texto)) libres.push({ fecha: f, momento: m });
    }
  }
  return libres;
}

/**
 * Rellena huecos con la IA, de semana en semana (cada petición tiene
 * que caber en el minuto que da Vercel).
 */
export async function rellenarConIA(
  huecos: { fecha: string; momento: Momento }[],
  deseo: string,
  quien: string,
  onProgreso: (hechas: number, total: number) => void,
): Promise<{ rellenados: number; error: string | null }> {
  const tandas: { fecha: string; momento: Momento }[][] = [];
  for (const h of [...huecos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const ultima = tandas[tandas.length - 1];
    if (ultima && ultima.length < 14 && h.fecha < sumarDias(ultima[0].fecha, 7)) ultima.push(h);
    else tandas.push([h]);
  }
  let rellenados = 0;
  for (let i = 0; i < tandas.length; i++) {
    onProgreso(i, tandas.length);
    const res = await pedirACocina({ accion: "plan", huecos: tandas[i], deseo }, quien);
    if (!res.ok) return { rellenados, error: res.error };
    rellenados += res.rellenados ?? 0;
  }
  onProgreso(tandas.length, tandas.length);
  return { rellenados, error: null };
}

/** La hoja de "Planificar con la IA": qué os apetece y a rellenar. */
export function HojaPlanificar({ abierta, huecos, quien, onCerrar, onHecho }: {
  abierta: boolean;
  huecos: { fecha: string; momento: Momento }[];
  quien: string;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const [deseo, setDeseo] = useState("");
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (abierta) { setError(null); setProgreso(null); } }, [abierta]);

  const empezar = async () => {
    setError(null);
    setProgreso({ hechas: 0, total: 1 });
    const res = await rellenarConIA(huecos, deseo.trim(), quien, (hechas, total) => setProgreso({ hechas, total }));
    setProgreso(null);
    if (res.error) { setError(res.error); if (res.rellenados) onHecho(); return; }
    onHecho();
    onCerrar();
  };

  const ideas = ["Algo de cuchara", "Comida asiática", "Platos con legumbre", "Cenas ligeras", "Algo nuevo con pescado", "Mucha verdura"];

  return (
    <Hoja abierta={abierta} onCerrar={() => { if (!progreso) onCerrar(); }} titulo="Planificar con la IA">
      {progreso ? (
        <>
          <Pensando texto={progreso.total > 1 ? `Semana ${Math.min(progreso.hechas + 1, progreso.total)} de ${progreso.total}` : "Preparando vuestro menú"} />
          <p style={{ fontSize: 12.5, color: BCN.humo, textAlign: "center", margin: 0 }}>Tarda un poquito: está pensando cada plato 🙂</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: BCN.tinta, margin: "0 0 14px", lineHeight: 1.5 }}>
            {huecos.length === 0
              ? "No queda ningún hueco libre en estos días. 🎉"
              : <>Hay <strong>{huecos.length} {huecos.length === 1 ? "hueco" : "huecos"}</strong> sin plato. Tiene en cuenta vuestros horarios, lo que os gusta y que la comida va en tupper.</>}
          </p>
          {huecos.length > 0 && (
            <>
              <Campo label="¿Algo que os apetezca? (opcional)">
                <input value={deseo} onChange={(e) => setDeseo(e.target.value)} placeholder="Ej: algo de cuchara, que haga frío" style={estiloInput} />
              </Campo>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "-4px 0 16px" }}>
                {ideas.map((i) => (
                  <button key={i} onClick={() => setDeseo(i)}
                    style={{ padding: "6px 11px", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, background: "white", fontSize: 12.5, color: BCN.tinta, cursor: "pointer" }}>
                    {i}
                  </button>
                ))}
              </div>
              {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}
              <BotonIA onClick={empezar}>Rellenar {huecos.length} {huecos.length === 1 ? "hueco" : "huecos"}</BotonIA>
            </>
          )}
        </>
      )}
    </Hoja>
  );
}

/* ─── Batch cooking ────────────────────────────────────────── */

export function HojaBatch({ rango, quien, onCerrar }: {
  rango: { desde: string; hasta: string } | null;
  quien: string;
  onCerrar: () => void;
}) {
  const [sesion, setSesion] = useState<SesionBatch | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedir = async (r: { desde: string; hasta: string }) => {
    setCargando(true);
    setError(null);
    setSesion(null);
    const res = await pedirACocina({ accion: "batch", desde: r.desde, hasta: r.hasta }, quien);
    setCargando(false);
    if (!res.ok) return setError(res.error);
    setSesion(res.batch ?? null);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (rango) pedir(rango); }, [rango?.desde, rango?.hasta]);

  const hora = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

  return (
    <Hoja abierta={rango !== null} onCerrar={onCerrar} titulo="Batch cooking 🍱">
      {rango && (
        <p style={{ fontSize: 13, color: BCN.humo, margin: "-10px 0 14px" }}>
          Para los platos del {fechaCorta(rango.desde)} al {fechaCorta(rango.hasta)}
        </p>
      )}
      {cargando && <Pensando texto="Organizando la sesión" />}
      {error && <Aviso>{error}</Aviso>}
      {sesion && (
        <>
          <div style={{ background: `${VERDE}12`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: 0, lineHeight: 1.3 }}>{sesion.titular}</p>
            <p style={{ fontSize: 13, color: VERDE, fontWeight: 700, margin: "6px 0 0" }}>⏱ Unas {hora(sesion.duracion_min)} h en total</p>
          </div>

          <Etiqueta>En orden</Etiqueta>
          <div style={{ position: "relative", paddingLeft: 18, marginBottom: 18 }}>
            <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: BCN.arenaOsc, borderRadius: 1 }} />
            {sesion.pasos.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                style={{ position: "relative", marginBottom: 12 }}>
                <span style={{ position: "absolute", left: -18, top: 4, width: 12, height: 12, borderRadius: "50%", background: VERDE, border: `2px solid ${BCN.arena}` }} />
                <p style={{ fontSize: 11.5, color: VERDE, fontWeight: 800, margin: 0, fontVariantNumeric: "tabular-nums" }}>{hora(p.minuto)} · {p.para}</p>
                <p style={{ fontSize: 14, color: BCN.tinta, margin: "2px 0 0", lineHeight: 1.45 }}>{p.tarea}</p>
              </motion.div>
            ))}
          </div>

          <Etiqueta>Cómo guardarlo</Etiqueta>
          <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden", marginBottom: 16 }}>
            {sesion.guardar.map((g, i) => (
              <div key={i} style={{ padding: "10px 13px", borderBottom: i === sesion.guardar.length - 1 ? "none" : `1px solid ${BCN.arena}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: BCN.tinta }}>{g.plato}</span>
                  <span style={{ fontSize: 12, color: BCN.oliva, fontWeight: 700, flexShrink: 0 }}>{g.dias} {g.dias === 1 ? "día" : "días"}</span>
                </div>
                <p style={{ fontSize: 12.5, color: BCN.humo, margin: "2px 0 0" }}>{g.como}</p>
              </div>
            ))}
          </div>

          <Aviso color={BCN.sol}>💡 {sesion.consejo}</Aviso>
        </>
      )}
    </Hoja>
  );
}

/* ─── Resumen de la semana ─────────────────────────────────── */

/** Se guarda en el móvil: el resumen de una semana no cambia cada vez que se abre. */
const claveResumen = (lunes: string) => `ra-super-resumen-${lunes}`;

export function ResumenSemanal({ lunes, quien, hayMenu }: { lunes: string; quien: string; hayMenu: boolean }) {
  const [resumen, setResumen] = useState<ResumenSemana | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    try {
      const guardado = localStorage.getItem(claveResumen(lunes));
      setResumen(guardado ? (JSON.parse(guardado) as ResumenSemana) : null);
    } catch { setResumen(null); }
  }, [lunes]);

  const pedir = async () => {
    setCargando(true);
    setError(null);
    const res = await pedirACocina({ accion: "resumen", lunes }, quien);
    setCargando(false);
    if (!res.ok || !res.resumen) return setError(res.ok ? "No ha salido nada." : res.error);
    setResumen(res.resumen);
    try { localStorage.setItem(claveResumen(lunes), JSON.stringify(res.resumen)); } catch { /* da igual */ }
  };

  const esta = lunes === lunesDe(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date()));

  return (
    <div style={{ background: "white", borderRadius: 18, border: `1px solid ${BCN.arenaOsc}`, padding: "15px 16px" }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: VERDE, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
        {esta ? "Esta semana" : `Semana del ${fechaCorta(lunes)}`}
      </p>
      {cargando ? (
        <Pensando texto="Repasando vuestra semana" />
      ) : resumen ? (
        <>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: "6px 0 10px", lineHeight: 1.3 }}>{resumen.titular}</p>
          {resumen.bien.map((b, i) => <Linea key={`b${i}`} icono="✅">{b}</Linea>)}
          {resumen.mejorar.map((m, i) => <Linea key={`m${i}`} icono="🌱">{m}</Linea>)}
          <div style={{ marginTop: 10 }}><Aviso color={BCN.sol}>💡 {resumen.consejo}</Aviso></div>
          <button onClick={pedir} style={{ marginTop: 8, background: "none", border: "none", color: BCN.humo, fontSize: 12.5, cursor: "pointer", padding: 4 }}>
            ↻ Volver a hacerlo
          </button>
        </>
      ) : (
        <>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 17, color: BCN.tinta, margin: "6px 0 12px" }}>¿Qué tal estáis comiendo?</p>
          {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}
          <BotonIA onClick={pedir} disabled={!hayMenu}>{hayMenu ? "Ver el resumen de la semana" : "Primero, algo en el menú"}</BotonIA>
        </>
      )}
    </div>
  );
}

function Linea({ icono, children }: { icono: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 13 }}>{icono}</span>
      <span style={{ fontSize: 13.5, color: BCN.tinta, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}

/* ─── Ajustes: vosotros y vuestra cocina ───────────────────── */

const PERSONAS: { id: Perfil["persona"]; nombre: string; sexo: Perfil["sexo"] }[] = [
  { id: "rut", nombre: "Rut", sexo: "m" },
  { id: "alejandro", nombre: "Alejandro", sexo: "h" },
];

export function HojaAjustes({ abierta, perfiles, equipos, onCerrar, onCambio }: {
  abierta: boolean;
  perfiles: Perfil[];
  equipos: Equipo[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [quien, setQuien] = useState<Perfil["persona"]>("rut");
  const [form, setForm] = useState({ edad: "", altura: "", peso: "", actividad: "ligera" as Actividad });
  const [misEquipos, setMisEquipos] = useState<Equipo[]>(equipos);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) return;
    const p = perfiles.find((x) => x.persona === quien);
    setForm({
      edad: p ? String(p.edad) : "",
      altura: p ? String(p.altura_cm) : "",
      peso: p ? String(p.peso_kg).replace(".", ",") : "",
      actividad: p?.actividad ?? "ligera",
    });
    setMensaje(null);
  }, [abierta, quien, perfiles]);

  useEffect(() => { if (abierta) setMisEquipos(equipos); }, [abierta, equipos]);

  const persona = PERSONAS.find((p) => p.id === quien)!;
  const edad = Number(form.edad);
  const altura = Number(form.altura);
  const peso = Number(form.peso.replace(",", "."));
  const valido = edad >= 14 && edad <= 100 && altura >= 120 && altura <= 230 && peso >= 30 && peso <= 250;
  const perfil: Perfil | null = valido
    ? { persona: quien, sexo: persona.sexo, edad, altura_cm: Math.round(altura), peso_kg: Math.round(peso * 10) / 10, actividad: form.actividad }
    : null;
  const dia = perfil ? necesidades(perfil) : null;
  const comidaCena = dia ? parteComidaYCena(dia) : null;

  const guardarDatos = async () => {
    if (!perfil) return;
    setGuardando(true);
    const ok = await guardarPerfil(perfil);
    setGuardando(false);
    setMensaje(ok ? `Guardado ✓ Ya calculo lo de ${persona.nombre}.` : "No se ha podido guardar.");
    if (ok) onCambio();
  };

  const alternarEquipo = async (e: Equipo) => {
    const nuevos = misEquipos.includes(e) ? misEquipos.filter((x) => x !== e) : [...misEquipos, e];
    setMisEquipos(nuevos);
    if (await guardarEquipos(nuevos)) onCambio();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Vosotros y vuestra cocina">
      <Etiqueta>Lo que necesita cada uno</Etiqueta>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {PERSONAS.map((p) => (
          <button key={p.id} onClick={() => setQuien(p.id)}
            style={{
              flex: 1, padding: "9px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: quien === p.id ? 700 : 500,
              border: `1.5px solid ${quien === p.id ? VERDE : BCN.arenaOsc}`, background: quien === p.id ? `${VERDE}12` : "white",
              color: quien === p.id ? VERDE : BCN.tinta,
            }}>
            {p.nombre}{perfiles.some((x) => x.persona === p.id) ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Campo label="Edad">
          <input value={form.edad} onChange={(e) => setForm({ ...form, edad: e.target.value })} inputMode="numeric" placeholder="20" style={estiloInput} />
        </Campo>
        <Campo label="Altura (cm)">
          <input value={form.altura} onChange={(e) => setForm({ ...form, altura: e.target.value })} inputMode="numeric" placeholder="170" style={estiloInput} />
        </Campo>
        <Campo label="Peso (kg)">
          <input value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} inputMode="decimal" placeholder="65" style={estiloInput} />
        </Campo>
      </div>

      <Campo label="¿Cuánto os movéis?">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(Object.keys(ACTIVIDAD) as Actividad[]).map((a) => {
            const activa = form.actividad === a;
            return (
              <button key={a} onClick={() => setForm({ ...form, actividad: a })}
                style={{
                  padding: "9px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${activa ? VERDE : BCN.arenaOsc}`, background: activa ? `${VERDE}12` : "white",
                }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: activa ? VERDE : BCN.tinta }}>{ACTIVIDAD[a].label}</span>
                <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, marginTop: 1 }}>{ACTIVIDAD[a].detalle}</span>
              </button>
            );
          })}
        </div>
      </Campo>

      {dia && comidaCena && (
        <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, padding: "12px 14px", marginBottom: 10 }}>
          <p style={{ fontSize: 13, color: BCN.tinta, margin: 0, lineHeight: 1.5 }}>
            Para comer sano y mantenerse, {persona.nombre} necesita unas <strong>{dia.kcal.toLocaleString("es-ES")} kcal</strong> al día.
            En comida y cena, unas <strong>{comidaCena.kcal.toLocaleString("es-ES")} kcal</strong>: {comidaCena.proteinas} g de proteína,
            {" "}{comidaCena.hidratos} g de hidratos, {comidaCena.grasas} g de grasa y {comidaCena.fibra} g de fibra.
          </p>
          <p style={{ fontSize: 11.5, color: BCN.humo, margin: "6px 0 0" }}>
            Es una guía, no una dieta: el desayuno y lo de entre horas ponen el resto.
          </p>
        </div>
      )}

      {mensaje && <p style={{ fontSize: 13, color: VERDE, margin: "0 0 6px" }}>{mensaje}</p>}
      <Boton onClick={guardarDatos} disabled={!valido || guardando} color={VERDE}>
        {guardando ? "Guardando…" : `Guardar lo de ${persona.nombre}`}
      </Boton>

      <div style={{ marginTop: 24 }}>
        <Etiqueta>Lo que hay en la cocina</Etiqueta>
        <p style={{ fontSize: 12.5, color: BCN.humo, margin: "-4px 0 10px 3px" }}>
          La IA solo propone recetas que podéis hacer. Cuando os mudéis, marcad el horno y la freidora de aire. 🏡
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(Object.keys(EQUIPOS) as Equipo[]).map((e) => {
            const tiene = misEquipos.includes(e);
            return (
              <motion.button key={e} whileTap={{ scale: 0.96 }} onClick={() => alternarEquipo(e)}
                style={{
                  padding: "11px 10px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${tiene ? VERDE : BCN.arenaOsc}`, background: tiene ? `${VERDE}12` : "white",
                  fontSize: 13.5, fontWeight: tiene ? 700 : 500, color: tiene ? VERDE : BCN.humo,
                }}>
                {EQUIPOS[e].icon} {EQUIPOS[e].label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </Hoja>
  );
}

/** Los siete días de una semana a partir de su lunes. Atajo para las pestañas. */
export function semanaDe(fecha: string): { lunes: string; dias: string[] } {
  const lunes = lunesDe(fecha);
  return { lunes, dias: diasDeSemana(lunes) };
}
