"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, EJES, type Barrio, type Etapa, type Valoracion, type EjeKey } from "@/lib/barcelona/types";
import { rankear, fraseCompat, LECTURA, colorCompat, type Compatibilidad } from "@/lib/barcelona/compat";
import { getEtapaActiva, getBarrios, getValoraciones, upsertValoracion, updateBarrio, addBarrio, deleteBarrio } from "@/lib/barcelona/queries";
import { avisar } from "@/lib/barcelona/avisar";
import { Pantalla, Vacio, Hoja, Campo, estiloInput, Boton, IconoMas } from "@/components/barcelona/Shell";

export default function BarriosPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [anadiendo, setAnadiendo] = useState(false);
  const [valoraciones, setValoraciones] = useState<Valoracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [valorando, setValorando] = useState<Barrio | null>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);
    const [b, v] = await Promise.all([getBarrios(e.id), getValoraciones(e.id, "barrio")]);
    setBarrios(b);
    setValoraciones(v);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const ranking = rankear(barrios, valoraciones);
  const valorados = ranking.filter((r) => r.compat.porcentaje !== null);
  const pendientes = ranking.filter((r) => r.compat.porcentaje === null);

  return (
    <Pantalla
      titulo="Barrios"
      subtitulo={valorados.length > 0 ? `${valorados.length} de ${barrios.length} valorados` : "Posibilidades de vida"}
      accion={{ icon: IconoMas, label: "Añadir un sitio", onClick: () => setAnadiendo(true) }}
      color={BCN.sol}
    >
      {cargando ? (
        <Cargando />
      ) : barrios.length === 0 ? (
        <Vacio icon="🌆" titulo="No hay barrios" texto="Ejecuta el SQL de Barcelona para cargar los barrios de la ciudad." />
      ) : (
        <>
          {valorados.length > 0 && (
            <>
              <p style={etiqueta}>Vuestro ranking</p>
              {valorados.map(({ entidad, compat }, i) => (
                <TarjetaBarrio
                  key={entidad.id}
                  barrio={entidad} compat={compat} posicion={i + 1} delay={i * 0.05}
                  expandido={expandido === entidad.id}
                  onToggle={() => setExpandido(expandido === entidad.id ? null : entidad.id)}
                  onValorar={() => setValorando(entidad)}
                />
              ))}
            </>
          )}

          {pendientes.length > 0 && (
            <>
              <p style={{ ...etiqueta, marginTop: valorados.length > 0 ? 26 : 0 }}>
                Por descubrir
              </p>
              {pendientes.map(({ entidad, compat }, i) => (
                <TarjetaBarrio
                  key={entidad.id}
                  barrio={entidad} compat={compat} posicion={null} delay={i * 0.03}
                  expandido={expandido === entidad.id}
                  onToggle={() => setExpandido(expandido === entidad.id ? null : entidad.id)}
                  onValorar={() => setValorando(entidad)}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* Hoja de valoración */}
      <HojaValorar
        barrio={valorando}
        etapaId={etapa?.id ?? null}
        usuario={user}
        valoracionActual={valoraciones.find((v) => v.entidad_id === valorando?.id && v.usuario === user) ?? null}
        onCerrar={() => setValorando(null)}
        onGuardado={async () => { setValorando(null); await cargar(); }}
        onBorrado={async () => { setValorando(null); await cargar(); }}
      />
      <HojaNuevoBarrio
        abierta={anadiendo}
        etapaId={etapa?.id ?? null}
        usuario={user}
        onCerrar={() => setAnadiendo(false)}
        onGuardado={async () => { setAnadiendo(false); await cargar(); }}
      />
    </Pantalla>
  );
}

/* ─── Un sitio nuevo ───────────────────────────────────────────
   No solo barrios: un pueblo del Maresme, una zona que os han
   recomendado, lo que sea que estéis mirando para vivir.
   ─────────────────────────────────────────────────────────── */

function HojaNuevoBarrio({ abierta, etapaId, usuario, onCerrar, onGuardado }: {
  abierta: boolean; etapaId: string | null; usuario: UserName;
  onCerrar: () => void; onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) return;
    setNombre(""); setDescripcion("");
    setCoords(null); setAviso(null);
  }, [abierta]);

  /** Buscar el sitio por su nombre, para que caiga en el mapa. */
  const situar = async () => {
    if (!nombre.trim() || ubicando) return;
    setUbicando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/barcelona/situar?q=${encodeURIComponent(nombre.trim())}`);
      const d = await res.json();
      if (d.lat && d.lng) {
        setCoords({ lat: d.lat, lng: d.lng });
        setAviso(d.nombre ? `Encontrado: ${d.nombre}` : "Situado en el mapa");
        if (!descripcion.trim() && d.zona) setDescripcion(d.zona);
      } else {
        setAviso("No lo hemos encontrado. Se guarda igual, pero no saldrá en el mapa.");
      }
    } catch {
      setAviso("No hemos podido buscarlo ahora mismo.");
    } finally {
      setUbicando(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim() || !etapaId || guardando) return;
    setGuardando(true);
    await addBarrio(etapaId, {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    });
    avisar(usuario, "barrio", nombre.trim());
    setGuardando(false);
    onGuardado();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Añadir un sitio">
      <p style={{ fontSize: 13, color: BCN.humo, margin: "-10px 0 16px", lineHeight: 1.55 }}>
        Un barrio, un pueblo, una zona. Lo que estéis mirando para vivir,
        aunque no sea Barcelona.
      </p>

      <Campo label="Nombre">
        <input
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); setCoords(null); }}
          placeholder="Vilassar de Mar"
          style={estiloInput}
        />
        <button
          onClick={situar}
          disabled={!nombre.trim() || ubicando}
          style={{
            width: "100%", marginTop: 8, padding: "11px", borderRadius: 12,
            cursor: nombre.trim() && !ubicando ? "pointer" : "default",
            border: `1.5px solid ${coords ? BCN.oliva : BCN.arenaOsc}`,
            background: coords ? `${BCN.oliva}12` : "white",
            color: coords ? BCN.oliva : BCN.mar,
            fontSize: 13.5, fontWeight: 600,
          }}
        >
          {ubicando ? "Buscando…" : coords ? "✓ Situado en el mapa" : "📍 Buscarlo en el mapa"}
        </button>
        {aviso && (
          <p style={{ fontSize: 12.5, color: coords ? BCN.oliva : BCN.humo, margin: "7px 0 0", lineHeight: 1.5 }}>
            {aviso}
          </p>
        )}
      </Campo>

      <Campo label="¿Por qué lo miráis?">
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
          placeholder="Opcional. Lo que os han contado, por qué os llama…"
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>

      <Boton onClick={guardar} disabled={!nombre.trim() || guardando} color={BCN.sol}>
        {guardando ? "Guardando…" : "Añadir"}
      </Boton>
    </Hoja>
  );
}

/* ─── Tarjeta de barrio ────────────────────────────────────── */

function TarjetaBarrio({ barrio, compat, posicion, delay, expandido, onToggle, onValorar }: {
  barrio: Barrio; compat: Compatibilidad; posicion: number | null; delay: number;
  expandido: boolean; onToggle: () => void; onValorar: () => void;
}) {
  const color = barrio.color ?? BCN.teja;
  const lectura = LECTURA[compat.estado];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
      style={{
        background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 18,
        marginBottom: 10, overflow: "hidden",
        boxShadow: expandido ? "0 6px 22px rgba(44,36,32,0.09)" : "0 2px 8px rgba(44,36,32,0.04)",
        transition: "box-shadow 0.2s",
      }}
    >
      <button onClick={onToggle}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "15px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        {compat.porcentaje !== null ? (
          <Medidor porcentaje={compat.porcentaje} color={colorCompat(compat.porcentaje)} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: "50%", border: `2px dashed ${BCN.arenaOsc}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17, color: BCN.humo }}>
            ?
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {posicion !== null && (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: color, background: `${color}18`, padding: "2px 6px", borderRadius: 5 }}>
                #{posicion}
              </span>
            )}
            <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: 0 }}>{barrio.nombre}</p>
          </div>
          <p style={{ fontSize: 12.5, color: BCN.humo, margin: "3px 0 0", lineHeight: 1.4,
            display: "-webkit-box", WebkitLineClamp: expandido ? 4 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {barrio.descripcion}
          </p>
          {compat.porcentaje !== null && (
            <p style={{ fontSize: 11.5, fontWeight: 700, color: lectura.color, margin: "5px 0 0" }}>
              {lectura.icon} {lectura.titulo}
            </p>
          )}
        </div>

        <span style={{ color: BCN.humo, fontSize: 17, transform: expandido ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
      </button>

      <AnimatePresence>
        {expandido && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${BCN.arena}` }}>
              {/* Ejes */}
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}>
                {compat.ejes.map((eje) => (
                  <Eje key={eje.key} eje={eje} color={color} />
                ))}
              </div>

              {/* Lectura */}
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: BCN.arena, borderLeft: `3px solid ${lectura.color}` }}>
                <p style={{ fontSize: 13.5, color: BCN.tinta, margin: 0, lineHeight: 1.55 }}>
                  {fraseCompat(compat, barrio.nombre)}
                </p>
              </div>

              {/* Notas */}
              {(compat.notaAle || compat.notaRut) && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {compat.notaAle && <Nota quien="Alejandro" texto={compat.notaAle} color={BCN.mar} />}
                  {compat.notaRut && <Nota quien="Rut" texto={compat.notaRut} color={BCN.teja} />}
                </div>
              )}

              <button onClick={onValorar}
                style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: "none", background: color, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {compat.faltan.length === 2 ? "Valorar este barrio" : "Actualizar mi valoración"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Eje({ eje, color }: { eje: Compatibilidad["ejes"][number]; color: string }) {
  const pct = (n: number | null) => (n === null ? 0 : (n / 10) * 100);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 12 }}>{eje.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: BCN.tinta }}>{eje.label}</span>
        {eje.gap !== null && eje.gap >= 3 && (
          <span style={{ fontSize: 10, color: BCN.mar, background: `${BCN.mar}15`, padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
            {eje.gap} de diferencia
          </span>
        )}
      </div>
      {[
        { quien: "A", valor: eje.ale, c: BCN.mar },
        { quien: "R", valor: eje.rut, c: color },
      ].map((f) => (
        <div key={f.quien} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: BCN.humo, width: 9 }}>{f.quien}</span>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: BCN.arena, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }} animate={{ width: `${pct(f.valor)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{ height: "100%", background: f.valor === null ? BCN.arenaOsc : f.c, borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: f.valor === null ? BCN.arenaOsc : BCN.tinta, width: 14, textAlign: "right" }}>
            {f.valor ?? "–"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Nota({ quien, texto, color }: { quien: string; texto: string; color: string }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 11, background: `${color}0D`, border: `1px solid ${color}22` }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{quien}</p>
      <p style={{ fontSize: 13.5, color: BCN.tinta, margin: "3px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>"{texto}"</p>
    </div>
  );
}

function Medidor({ porcentaje, color }: { porcentaje: number; color: string }) {
  const size = 52, r = size / 2 - 3.5, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BCN.arena} strokeWidth={3.5} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * porcentaje) / 100 }}
          transition={{ duration: 0.9, ease: "easeOut" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 15, color: BCN.tinta }}>{porcentaje}</span>
      </div>
    </div>
  );
}

/* ─── Hoja de valoración ───────────────────────────────────── */

function HojaValorar({ barrio, etapaId, usuario, valoracionActual, onCerrar, onGuardado, onBorrado }: {
  barrio: Barrio | null; etapaId: string | null; usuario: UserName;
  valoracionActual: Valoracion | null;
  onCerrar: () => void; onGuardado: () => void; onBorrado: () => void;
}) {
  const [valores, setValores] = useState<Record<EjeKey, number>>({
    transporte: 5, ambiente: 5, precio: 5, sensacion: 5,
  });
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!barrio) return;
    setValores({
      transporte: valoracionActual?.transporte ?? 5,
      ambiente:   valoracionActual?.ambiente   ?? 5,
      precio:     valoracionActual?.precio     ?? 5,
      sensacion:  valoracionActual?.sensacion  ?? 5,
    });
    setNota(valoracionActual?.nota ?? "");
  }, [barrio, valoracionActual]);

  const guardar = async () => {
    if (!barrio || !etapaId) return;
    setGuardando(true);
    await upsertValoracion(etapaId, "barrio", barrio.id, usuario, { ...valores, nota: nota.trim() });
    avisar(usuario, "valoracion_barrio", barrio.nombre);
    await updateBarrio(barrio.id, { visitado: true });
    setGuardando(false);
    onGuardado();
  };

  const color = barrio?.color ?? BCN.teja;

  return (
    <Hoja abierta={!!barrio} onCerrar={onCerrar} titulo={barrio ? `¿Qué te parece ${barrio.nombre}?` : ""}>
      <p style={{ fontSize: 13, color: BCN.humo, margin: "-10px 0 20px", lineHeight: 1.5 }}>
        Tu valoración, {usuario === "alejandro" ? "Alejandro" : "Rut"}. Del 1 al 10, sin pensarlo demasiado.
      </p>

      {EJES.map((e) => (
        <div key={e.key} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 15, marginRight: 7 }}>{e.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: BCN.tinta }}>{e.label}</span>
            <span style={{ marginLeft: "auto", fontFamily: "Georgia, serif", fontSize: 19, color }}>
              {valores[e.key]}
            </span>
          </div>
          <input
            type="range" min={1} max={10} step={1}
            value={valores[e.key]}
            onChange={(ev) => setValores({ ...valores, [e.key]: Number(ev.target.value) })}
            style={{ width: "100%", accentColor: color, height: 26 }}
          />
        </div>
      ))}

      <Campo label="¿Algo que añadir?">
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3}
          placeholder="Lo que te gustó, lo que no te convence…"
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>

      <Boton onClick={guardar} disabled={guardando} color={color}>
        {guardando ? "Guardando…" : "Guardar valoración"}
      </Boton>

      <button
        onClick={async () => {
          if (!barrio) return;
          if (!confirm(`¿Quitar ${barrio.nombre} de la lista?

Se irán también vuestras valoraciones de este sitio.`)) return;
          await deleteBarrio(barrio.id);
          onBorrado();
        }}
        style={{
          width: "100%", marginTop: 10, padding: "12px", borderRadius: 12,
          border: "none", background: "transparent", color: BCN.teja,
          fontSize: 13.5, cursor: "pointer",
        }}
      >
        Quitar este sitio
      </button>
    </Hoja>
  );
}

function Cargando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 84, borderRadius: 18, background: BCN.arenaOsc }} />
      ))}
    </div>
  );
}

const etiqueta: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 800, color: BCN.humo,
  textTransform: "uppercase", letterSpacing: "0.13em", margin: "0 0 11px",
};
