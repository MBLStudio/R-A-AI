"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN } from "@/lib/barcelona/types";
import {
  PERSONAS, TIPO_DIA, hoyMadrid, horaMadrid, lunesDe, sumarDias, diasDeSemana,
  fechaCorta, rangoSemana, limitesMes, aMinutos, minutosTurno, textoHoras, totalVentas, euros, resumenMes,
  getTurnos, getProximoTurno, getVentas,
  type Persona, type Turno, type Venta, type Tramo,
} from "@/lib/barcelona/trabajo";
import { Pantalla, Tarjeta, Selector } from "@/components/barcelona/Shell";
import { DiaTrabajo } from "@/components/barcelona/DiaTrabajo";
import { HojaTurno } from "@/components/barcelona/HojaTurno";
import { HojaSemana } from "@/components/barcelona/HojaSemana";
import { HojaVenta } from "@/components/barcelona/HojaVenta";

/* ═══════════════════════════════════════════════════════════
   Trabajo — el horario de la semana, de un vistazo.
   Lo primero es saber cuándo se trabaja; las ventas van en
   segundo plano, dentro de cada día al desplegarlo.
   ═══════════════════════════════════════════════════════════ */

const IconoSemana = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="16" rx="3" stroke="white" strokeWidth="2" />
    <path d="M3 10h18M8 3v4M16 3v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M7.5 14.5h2M11 14.5h2M14.5 14.5h2M7.5 17.5h2M11 17.5h2" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function TrabajoPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  useEffect(() => {
    if (user && user !== activeUser) setUser(user, user);
  }, [user, activeUser, setUser]);

  const hoy = hoyMadrid();
  // Cada uno entra viendo su propio horario; el del otro, con el selector
  const [persona, setPersona] = useState<Persona>(() =>
    PERSONAS.some((p) => p.id === user) ? (user as Persona) : PERSONAS[0].id
  );
  const config = PERSONAS.find((p) => p.id === persona) ?? PERSONAS[0];

  const [lunes, setLunes] = useState(() => lunesDe(hoyMadrid()));
  const [direccion, setDireccion] = useState(0);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [ventasMes, setVentasMes] = useState<Venta[]>([]);
  const [turnoHoy, setTurnoHoy] = useState<Turno | null>(null);
  const [proximo, setProximo] = useState<Turno | null>(null);
  const [cargando, setCargando] = useState(true);

  // El día desplegado en la lista (hoy, al entrar) y el día cuyo horario se edita en la hoja
  const [desplegado, setDesplegado] = useState<string | null>(() => hoyMadrid());
  const [diaAbierto, setDiaAbierto] = useState<string | null>(null);
  const [rellenando, setRellenando] = useState(false);
  const [ventaAbierta, setVentaAbierta] = useState<{ fecha: string; venta: Venta | null } | null>(null);

  const dias = diasDeSemana(lunes);
  const esEstaSemana = dias.includes(hoy);
  // El mes del resumen: el de hoy si se ve esta semana; si no, el de la semana que se mira
  const mes = limitesMes(esEstaSemana ? hoy : sumarDias(lunes, 3));
  const { desde: mesDesde, hasta: mesHasta } = mes;
  const conVentas = config.ventas;

  // Si se cambia de semana muy rápido, solo vale la última respuesta
  const peticion = useRef(0);

  const cargar = useCallback(async () => {
    const n = ++peticion.current;
    const domingo = sumarDias(lunes, 6);
    const sinVentas = Promise.resolve([] as Venta[]);
    const [t, v, vm, th, px] = await Promise.all([
      getTurnos(persona, lunes, domingo),
      conVentas ? getVentas(persona, lunes, domingo) : sinVentas,
      conVentas ? getVentas(persona, mesDesde, mesHasta) : sinVentas,
      getTurnos(persona, hoy, hoy),
      getProximoTurno(persona, hoy),
    ]);
    if (n !== peticion.current) return;
    setTurnos(t);
    setVentas(v);
    setVentasMes(vm);
    setTurnoHoy(th[0] ?? null);
    setProximo(px);
    setCargando(false);
  }, [persona, lunes, mesDesde, mesHasta, conVentas, hoy]);

  useEffect(() => { cargar(); }, [cargar]);

  const mover = (d: number) => {
    const l = sumarDias(lunes, 7 * d);
    setDireccion(d);
    setCargando(true);
    setLunes(l);
    // En la semana de hoy se despliega hoy; en las demás, ninguno
    setDesplegado(diasDeSemana(l).includes(hoy) ? hoy : null);
  };

  const irAHoy = () => {
    setDesplegado(hoy);
    const l = lunesDe(hoy);
    if (l === lunes) return;
    setDireccion(l < lunes ? -1 : 1);
    setCargando(true);
    setLunes(l);
  };

  const turnoDe = (f: string) => turnos.find((t) => t.fecha === f) ?? (f === hoy ? turnoHoy : null);
  const ventasDe = (f: string) => ventas.filter((v) => v.fecha === f);

  /** Para un día nuevo, los tramos del día de trabajo más cercano de esa semana. */
  const sugerencia = useMemo<Tramo[]>(() => {
    if (!diaAbierto) return [];
    const trabajo = turnos.filter((t) => t.tipo === "trabajo");
    const antes = [...trabajo].reverse().find((t) => t.fecha < diaAbierto);
    return (antes ?? trabajo.find((t) => t.fecha > diaAbierto))?.tramos ?? [];
  }, [diaAbierto, turnos]);

  const minutosSemana = turnos.reduce((s, t) => s + minutosTurno(t), 0);
  const diasTrabajo = turnos.filter((t) => t.tipo === "trabajo").length;

  const etiquetaSemana =
    esEstaSemana ? "Esta semana" :
    lunes === sumarDias(lunesDe(hoy), -7) ? "La semana pasada" :
    lunes === sumarDias(lunesDe(hoy), 7) ? "La semana que viene" : "";

  return (
    <>
      <Pantalla
        titulo="Trabajo"
        subtitulo={`Horario de ${config.nombre}`}
        color={BCN.mar}
        accion={{ icon: IconoSemana, onClick: () => setRellenando(true), label: "Rellenar la semana" }}
      >
        {PERSONAS.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <Selector<Persona>
              valor={persona}
              color={BCN.mar}
              onChange={(p) => { setCargando(true); setPersona(p); }}
              opciones={PERSONAS.map((p) => ({ valor: p.id, label: p.nombre }))}
            />
          </div>
        )}

        {/* Hoy: lo que más se consulta */}
        {!cargando || turnoHoy || proximo ? (
          <TarjetaHoy
            hoy={hoy}
            turno={turnoHoy}
            proximo={proximo}
            conVentas={config.ventas}
            onAbrir={irAHoy}
            onVenta={() => setVentaAbierta({ fecha: hoy, venta: null })}
          />
        ) : (
          <div style={{ height: 96, borderRadius: 18, background: BCN.arenaOsc, opacity: 0.5 }} />
        )}

        {/* Navegación de semanas */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 12px" }}>
          <BotonFlecha izquierda onClick={() => mover(-1)} />
          <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: 0, lineHeight: 1.2 }}>
              {rangoSemana(lunes)}
            </p>
            <p style={{ fontSize: 11.5, color: BCN.humo, margin: "2px 0 0", minHeight: 14 }}>{etiquetaSemana}</p>
          </div>
          <BotonFlecha onClick={() => mover(1)} />
          <button onClick={irAHoy} disabled={esEstaSemana}
            style={{
              padding: "8px 13px", borderRadius: 18, border: `1px solid ${esEstaSemana ? BCN.arenaOsc : BCN.teja}`,
              background: esEstaSemana ? "transparent" : BCN.teja, color: esEstaSemana ? BCN.humo : "white",
              fontSize: 13, fontWeight: 700, cursor: esEstaSemana ? "default" : "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}>
            Hoy
          </button>
        </div>

        {/* Resumen de la semana */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Dato
            valor={cargando ? "–" : textoHoras(minutosSemana)}
            label={diasTrabajo === 1 ? "1 día de trabajo" : `${diasTrabajo} días de trabajo`}
            color={BCN.mar}
            flex={1.25}
          />
          {config.ventas && (
            <Dato
              valor={cargando ? "–" : euros(totalVentas(ventas))}
              label={ventas.length === 1 ? "1 venta" : `${ventas.length} ventas`}
              color={BCN.tinta}
              flex={1}
              pequeno
            />
          )}
        </div>

        {/* Semana vacía */}
        {!cargando && turnos.length === 0 && (
          <button onClick={() => setRellenando(true)}
            style={{
              width: "100%", marginBottom: 10, padding: "12px 14px", borderRadius: 14, cursor: "pointer",
              border: `1.5px dashed ${BCN.mar}55`, background: `${BCN.mar}0A`, textAlign: "left",
              display: "flex", alignItems: "center", gap: 10,
            }}>
            <span style={{ fontSize: 18 }}>🗓️</span>
            <span style={{ flex: 1, fontSize: 13.5, color: BCN.tinta }}>
              Aún no hay horario esta semana.{" "}
              <strong style={{ color: BCN.mar }}>Rellenar la semana</strong>
            </span>
          </button>
        )}

        {/* Los 7 días: se tocan y se despliegan ahí mismo */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${persona}-${lunes}`}
            initial={{ opacity: 0, x: direccion * 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direccion * -22 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${BCN.arenaOsc}`, boxShadow: "0 2px 10px rgba(44,36,32,0.04)" }}
          >
            {dias.map((f, i) => (
              <DiaTrabajo
                key={f}
                fecha={f}
                persona={persona}
                turno={turnoDe(f)}
                ventas={ventasDe(f)}
                esHoy={f === hoy}
                abierto={desplegado === f}
                cargando={cargando}
                conVentas={config.ventas}
                ultima={i === 6}
                onAlternar={() => setDesplegado((d) => (d === f ? null : f))}
                onEditarHorario={() => setDiaAbierto(f)}
                onEditarVenta={(v) => setVentaAbierta({ fecha: v.fecha, venta: v })}
                onCambio={cargar}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Resumen del mes */}
        {config.ventas && !cargando && <ResumenMes nombre={mes.nombre} ventas={ventasMes} />}
      </Pantalla>

      <HojaTurno
        fecha={diaAbierto}
        persona={persona}
        turno={diaAbierto ? turnoDe(diaAbierto) : null}
        sugerencia={sugerencia}
        onCerrar={() => setDiaAbierto(null)}
        onGuardado={cargar}
      />

      <HojaSemana
        abierta={rellenando}
        persona={persona}
        lunes={lunes}
        turnos={turnos}
        onCerrar={() => setRellenando(false)}
        onGuardado={cargar}
      />

      {/* La última: se abre por encima de la hoja del día */}
      <HojaVenta
        abierta={ventaAbierta}
        persona={persona}
        onCerrar={() => setVentaAbierta(null)}
        onGuardado={cargar}
      />
    </>
  );
}

/* ─── Hoy ──────────────────────────────────────────────────── */

function TarjetaHoy({ hoy, turno, proximo, conVentas, onAbrir, onVenta }: {
  hoy: string; turno: Turno | null; proximo: Turno | null; conVentas: boolean;
  onAbrir: () => void; onVenta: () => void;
}) {
  const trabaja = turno?.tipo === "trabajo";
  const color = turno ? TIPO_DIA[turno.tipo].color : BCN.humo;

  let arriba: string;
  let principal: string;
  let abajo: string;

  if (trabaja) {
    const ahora = aMinutos(horaMadrid());
    const enCurso = turno.tramos.find((t) => ahora >= aMinutos(t.inicio) && ahora < aMinutos(t.fin));
    const siguiente = turno.tramos.find((t) => ahora < aMinutos(t.inicio));
    arriba = `Hoy · ${fechaCorta(hoy)}`;
    principal = turno.tramos.map((t) => `${t.inicio}–${t.fin}`).join("  ·  ");
    abajo =
      enCurso ? `Trabajando ahora · sales a las ${enCurso.fin}` :
      siguiente ? `Entras a las ${siguiente.inicio} · ${textoHoras(minutosTurno(turno))}` :
      "Turno terminado por hoy";
  } else {
    arriba =
      turno?.tipo === "libre" ? "Hoy libre ☕" :
      turno?.tipo === "vacaciones" ? "Hoy de vacaciones 🌴" :
      turno?.tipo === "festivo" ? "Hoy es festivo 🎉" :
      `Hoy · ${fechaCorta(hoy)}`;
    principal = proximo
      ? `Próximo turno: ${proximo.fecha === sumarDias(hoy, 1) ? "mañana" : fechaCorta(proximo.fecha)}`
      : turno ? "Disfruta del día" : "Sin turno apuntado";
    abajo = proximo ? proximo.tramos.map((t) => `${t.inicio}–${t.fin}`).join(" · ") : "No hay más turnos apuntados";
  }

  return (
    <motion.div
      role="button" tabIndex={0}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      whileTap={{ scale: 0.985 }}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === "Enter") onAbrir(); }}
      style={{
        borderRadius: 18, padding: "16px 18px", cursor: "pointer",
        background: `linear-gradient(140deg, ${color} 0%, ${BCN.noche} 130%)`,
        boxShadow: `0 6px 22px ${color}40`,
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>
          {arriba}
        </p>
        <p style={{ fontFamily: "Georgia, serif", fontSize: trabaja ? 25 : 20, color: "white", margin: "5px 0 0", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
          {principal}
        </p>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.78)", margin: "5px 0 0" }}>
          {abajo}
          {turno?.nota ? ` · ${turno.nota}` : ""}
        </p>
      </div>
      {trabaja && conVentas && (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={(e) => { e.stopPropagation(); onVenta(); }}
          style={{
            flexShrink: 0, padding: "9px 13px", borderRadius: 20, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.2)", color: "white", fontSize: 13, fontWeight: 700,
            backdropFilter: "blur(6px)",
          }}>
          + Venta
        </motion.button>
      )}
    </motion.div>
  );
}

/* ─── Piezas pequeñas ──────────────────────────────────────── */

function BotonFlecha({ izquierda = false, onClick }: { izquierda?: boolean; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} aria-label={izquierda ? "Semana anterior" : "Semana siguiente"}
      style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
        background: "white", border: `1px solid ${BCN.arenaOsc}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: izquierda ? "none" : "rotate(180deg)" }}>
        <path d="M15 18l-6-6 6-6" stroke={BCN.tinta} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}

function Dato({ valor, label, color, flex, pequeno = false }: {
  valor: string; label: string; color: string; flex: number; pequeno?: boolean;
}) {
  return (
    <div style={{
      flex, minWidth: 0, background: "white", borderRadius: 14,
      border: `1px solid ${BCN.arenaOsc}`, padding: "11px 13px",
    }}>
      <p style={{ fontFamily: "Georgia, serif", fontSize: pequeno ? 17 : 21, color, margin: 0, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </p>
      <p style={{ fontSize: 11, color: BCN.humo, margin: "4px 0 0" }}>{label}</p>
    </div>
  );
}

function ResumenMes({ nombre, ventas }: { nombre: string; ventas: Venta[] }) {
  const r = resumenMes(ventas);
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={{ marginTop: 24 }}>
      <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 9px 3px" }}>
        Ventas de {nombre.toLowerCase()}
      </p>
      <Tarjeta>
        {r.n === 0 ? (
          <p style={{ fontSize: 13.5, color: BCN.humo, margin: 0, textAlign: "center" }}>Todavía no hay ventas este mes.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 12px" }}>
            <DatoMes label="Total" valor={euros(r.total)} destacado />
            <DatoMes label="Ventas" valor={String(r.n)} />
            <DatoMes label="Ticket medio" valor={euros(r.ticketMedio)} />
            {r.mejorDia && <DatoMes label="Mejor día" valor={fechaCorta(r.mejorDia.fecha)} sub={euros(r.mejorDia.total)} />}
          </div>
        )}
      </Tarjeta>
    </motion.section>
  );
}

function DatoMes({ label, valor, sub, destacado = false }: { label: string; valor: string; sub?: string; destacado?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 11, color: BCN.humo, margin: 0 }}>{label}</p>
      <p style={{ fontFamily: "Georgia, serif", fontSize: destacado ? 20 : 17, color: destacado ? BCN.teja : BCN.tinta, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </p>
      {sub && <p style={{ fontSize: 11.5, color: BCN.oliva, margin: "1px 0 0", fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}
