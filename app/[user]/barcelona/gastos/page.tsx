"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, type Etapa } from "@/lib/barcelona/types";
import {
  getBotes, addBote, getGastos, addGasto, updateGasto, deleteGasto,
  getFijos, addFijo, updateFijo, deleteFijo, apuntarFijosPendientes,
  saldoDelBote, calcularBalance, porCategoria,
  mesesConMovimiento, nombreDelMes, delMes,
  categoria, CATEGORIAS, euros, eurosCorto,
  type Bote, type Gasto, type GastoFijo, type FormaPago, type Medio,
} from "@/lib/barcelona/gastos";
import { getEtapaActiva, hoyISO } from "@/lib/barcelona/queries";
import { avisar } from "@/lib/barcelona/avisar";
import { uploadPhoto } from "@/lib/upload";
import { Pantalla, Vacio, Hoja, Campo, estiloInput, Boton, IconoMas } from "@/components/barcelona/Shell";
import { Visor, useVisor } from "@/components/barcelona/Visor";

/* ═══════════════════════════════════════════════════════════
   Gastos.

   El bote es la caja común: lo que sale de ahí es de los dos.
   Lo que adelanta uno queda a su nombre, y abajo se ve quién
   ha puesto más.
   ═══════════════════════════════════════════════════════════ */

type Vista = "movimientos" | "fijos";

export default function GastosPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [botes, setBotes] = useState<Bote[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [fijos, setFijos] = useState<GastoFijo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("movimientos");
  const [anotando, setAnotando] = useState<Gasto | "nuevo" | null>(null);
  const [editandoFijo, setEditandoFijo] = useState<GastoFijo | "nuevo" | null>(null);
  const [nuevoBote, setNuevoBote] = useState(false);
  const [boteParaRecargar, setBoteParaRecargar] = useState<string | null>(null);
  const [mes, setMes] = useState<string>(() => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);

    const [b, g, f] = await Promise.all([getBotes(e.id), getGastos(e.id), getFijos(e.id)]);
    setBotes(b);
    setFijos(f);

    // Los fijos que ya tocaban se apuntan solos al entrar
    const nuevos = await apuntarFijosPendientes(e.id, f, g);
    setGastos(nuevos > 0 ? await getGastos(e.id) : g);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const meses = useMemo(() => mesesConMovimiento(gastos), [gastos]);
  const delMesElegido = useMemo(() => delMes(gastos, mes), [gastos, mes]);

  // El saldo del bote es de siempre, no de un mes: el dinero no se
  // reinicia en enero. El resto sí se mira mes a mes.
  const balance = useMemo(() => calcularBalance(delMesElegido), [delMesElegido]);
  const categorias = useMemo(() => porCategoria(delMesElegido), [delMesElegido]);
  const gastadoEnElMes = useMemo(
    () => delMesElegido.filter((g) => g.tipo === "gasto" && !g.personal).reduce((t, g) => t + Number(g.importe), 0),
    [delMesElegido]
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, Gasto[]>();
    for (const g of delMesElegido) {
      if (!mapa.has(g.fecha)) mapa.set(g.fecha, []);
      mapa.get(g.fecha)!.push(g);
    }
    return [...mapa.entries()];
  }, [delMesElegido]);

  return (
    <Pantalla
      titulo="Gastos"
      subtitulo={gastos.length > 0 ? `${eurosCorto(gastadoEnElMes)} en ${nombreDelMes(mes).toLowerCase()}` : "La caja común"}
      color={BCN.oliva}
      accion={{
        icon: IconoMas,
        label: "Anotar",
        onClick: () => (vista === "fijos" ? setEditandoFijo("nuevo") : setAnotando("nuevo")),
      }}
    >
      {cargando ? (
        <p style={{ textAlign: "center", color: BCN.humo, fontSize: 14, padding: "40px 0" }}>Un momento…</p>
      ) : (
        <>
          {/* Los botes */}
          <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
            {botes.map((b) => {
              const saldo = saldoDelBote(gastos, b.id);
              // Lo que ha ido saliendo, para saber si el saldo da para mucho
              const salidas = gastos
                .filter((g) => g.bote_id === b.id && g.tipo === "gasto")
                .reduce((t, g) => t + Number(g.importe), 0);
              const vacio = saldo <= 0;
              const bajo = !vacio && salidas > 0 && saldo < salidas * 0.2;

              return (
                <button
                  key={b.id}
                  onClick={() => { setAnotando("nuevo"); setBoteParaRecargar(b.id); }}
                  style={{
                    flexShrink: 0, minWidth: 158, padding: "14px 16px", borderRadius: 16,
                    background: "white", border: `1px solid ${BCN.arenaOsc}`,
                    borderTop: `3px solid ${b.color}`, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, fontWeight: 600 }}>
                    {b.nombre}
                  </span>
                  <span style={{
                    display: "block", fontFamily: "Georgia, serif", fontSize: 25, marginTop: 4,
                    color: vacio ? BCN.teja : BCN.tinta, lineHeight: 1.1,
                  }}>
                    {eurosCorto(saldo)}
                  </span>
                  <span style={{
                    display: "block", fontSize: 10.5, marginTop: 5,
                    color: vacio || bajo ? BCN.teja : BCN.humo,
                    fontWeight: vacio || bajo ? 600 : 400,
                  }}>
                    {vacio ? "Vacío · tocad para recargar"
                      : bajo ? "Queda poco · recargar"
                      : "Tocad para meter dinero"}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setNuevoBote(true)}
              style={{
                flexShrink: 0, minWidth: 92, borderRadius: 16, cursor: "pointer",
                border: `1.5px dashed ${BCN.arenaOsc}`, background: "transparent",
                color: BCN.humo, fontSize: 12.5, padding: "14px 12px",
              }}
            >
              ＋<br />Otro bote
            </button>
          </div>

          {/* Quién ha puesto qué */}
          {(balance.total.alejandro > 0 || balance.total.rut > 0) && (
            <QuienHaPuesto balance={balance} />
          )}

          {/* Movimientos o fijos */}
          <div style={{ display: "flex", gap: 7, margin: "18px 0 14px" }}>
            {([["movimientos", "Movimientos"], ["fijos", "Fijos"]] as [Vista, string][]).map(([v, etiqueta]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                style={{
                  flex: 1, padding: "9px 6px", borderRadius: 11, cursor: "pointer",
                  border: `1px solid ${vista === v ? BCN.tinta : BCN.arenaOsc}`,
                  background: vista === v ? BCN.tinta : "white",
                  color: vista === v ? "white" : BCN.humo,
                  fontSize: 13, fontWeight: vista === v ? 700 : 500,
                }}
              >
                {etiqueta}
                {v === "fijos" && fijos.length > 0 && (
                  <span style={{ opacity: 0.65, fontSize: 12 }}> {fijos.length}</span>
                )}
              </button>
            ))}
          </div>

          {vista === "movimientos" && meses.length > 1 && (
            <div style={{
              display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 12,
            }}>
              {meses.map((m) => {
                const activo = m === mes;
                return (
                  <button
                    key={m}
                    onClick={() => setMes(m)}
                    style={{
                      flexShrink: 0, padding: "8px 14px", borderRadius: 18, cursor: "pointer",
                      border: `1px solid ${activo ? BCN.tinta : BCN.arenaOsc}`,
                      background: activo ? BCN.tinta : "white",
                      color: activo ? "white" : BCN.humo,
                      fontSize: 12.5, fontWeight: activo ? 700 : 500,
                    }}
                  >
                    {nombreDelMes(m)}
                  </button>
                );
              })}
            </div>
          )}

          {vista === "fijos" ? (
            fijos.length === 0 ? (
              <Vacio
                icon="🔁"
                titulo="Sin gastos fijos"
                texto="El alquiler, la luz, el móvil. Se apuntan una vez y vuelven solos cada mes. Podéis cambiar el importe cuando la factura venga distinta."
                accion={{ label: "Añadir uno", onClick: () => setEditandoFijo("nuevo") }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fijos.map((f) => (
                  <FilaFijo key={f.id} fijo={f} botes={botes} onEditar={() => setEditandoFijo(f)} />
                ))}
                <p style={{ fontSize: 12.5, color: BCN.humo, textAlign: "center", marginTop: 8, lineHeight: 1.55 }}>
                  Suman {euros(fijos.filter((f) => f.activo).reduce((t, f) => t + Number(f.importe), 0))} al mes.
                </p>
              </div>
            )
          ) : gastos.length === 0 ? (
            <Vacio
              icon="🧾"
              titulo="Todavía no hay nada"
              texto="Meted dinero en el bote y empezad a apuntar. Cada gasto puede llevar la foto de su ticket."
              accion={{ label: "Anotar el primero", onClick: () => setAnotando("nuevo") }}
            />
          ) : delMesElegido.length === 0 ? (
            <p style={{ textAlign: "center", color: BCN.humo, fontSize: 14, padding: "36px 0", lineHeight: 1.6 }}>
              Nada apuntado en {nombreDelMes(mes).toLowerCase()}.
            </p>
          ) : (
            <>
              {categorias.length > 1 && <EnQueSeVa categorias={categorias} />}

              {porDia.map(([fecha, delDia]) => (
                <div key={fecha} style={{ marginBottom: 14 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 800, color: BCN.humo, textTransform: "uppercase",
                    letterSpacing: "0.08em", margin: "0 0 7px",
                  }}>
                    {new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </p>
                  <div style={{ background: "white", borderRadius: 14, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden" }}>
                    {delDia.map((g, i) => (
                      <FilaGasto
                        key={g.id}
                        gasto={g}
                        primera={i === 0}
                        onClick={() => setAnotando(g)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      <HojaGasto
        abierta={anotando !== null}
        gasto={anotando === "nuevo" ? null : anotando}
        etapaId={etapa?.id ?? null}
        botes={botes}
        usuario={user}
        recargar={boteParaRecargar}
        onCerrar={() => { setAnotando(null); setBoteParaRecargar(null); }}
        onGuardado={async () => { setAnotando(null); setBoteParaRecargar(null); await cargar(); }}
      />

      <HojaFijo
        abierta={editandoFijo !== null}
        fijo={editandoFijo === "nuevo" ? null : editandoFijo}
        etapaId={etapa?.id ?? null}
        botes={botes}
        onCerrar={() => setEditandoFijo(null)}
        onGuardado={async () => { setEditandoFijo(null); await cargar(); }}
      />

      <HojaBote
        abierta={nuevoBote}
        etapaId={etapa?.id ?? null}
        onCerrar={() => setNuevoBote(false)}
        onGuardado={async () => { setNuevoBote(false); await cargar(); }}
      />
    </Pantalla>
  );
}

/* ─── Quién ha puesto qué ──────────────────────────────────── */

function QuienHaPuesto({ balance }: { balance: ReturnType<typeof calcularBalance> }) {
  const mayor = Math.max(balance.total.alejandro, balance.total.rut, 1);

  const barra = (quien: "alejandro" | "rut", nombre: string, color: string) => {
    const total = balance.total[quien];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: BCN.humo, width: 62, flexShrink: 0 }}>{nombre}</span>
        <div style={{ flex: 1, height: 22, background: BCN.arena, borderRadius: 6, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(total / mayor) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ height: "100%", background: color, borderRadius: 6 }}
          />
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: BCN.tinta, width: 68,
          textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums",
        }}>
          {eurosCorto(total)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ background: "white", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, padding: "15px 16px" }}>
      <p style={{
        fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase",
        letterSpacing: "0.1em", margin: "0 0 11px",
      }}>
        Quién ha puesto qué
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {barra("alejandro", "Alejandro", BCN.mar)}
        {barra("rut", "Rut", BCN.teja)}
      </div>

      {(balance.personal.alejandro > 0 || balance.personal.rut > 0) && (
        <p style={{
          fontSize: 12, color: BCN.humo, margin: "10px 0 0", paddingTop: 9,
          borderTop: `1px solid ${BCN.arena}`, lineHeight: 1.5,
        }}>
          En sus cosas: Alejandro {eurosCorto(balance.personal.alejandro)} ·
          Rut {eurosCorto(balance.personal.rut)}
          <span style={{ opacity: 0.75 }}> — no entra en el reparto</span>
        </p>
      )}

      <p style={{
        fontSize: 13, color: BCN.tinta, margin: "13px 0 0", paddingTop: 11,
        borderTop: `1px solid ${BCN.arena}`, lineHeight: 1.5,
      }}>
        {balance.quienVaDelante === null ? (
          <>Estáis en paz. 🤝</>
        ) : (
          <>
            <strong>{balance.quienVaDelante === "alejandro" ? "Alejandro" : "Rut"}</strong> ha puesto{" "}
            <strong>{euros(balance.diferencia)}</strong> más.{" "}
            <span style={{ color: BCN.humo }}>
              Para quedar en paz, {balance.quienVaDelante === "alejandro" ? "Rut" : "Alejandro"} le
              daría {euros(balance.deuda)}.
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/* ─── En qué se va ─────────────────────────────────────────── */

function EnQueSeVa({ categorias }: { categorias: { clave: string; total: number }[] }) {
  const total = categorias.reduce((t, c) => t + c.total, 0);
  if (total <= 0) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", height: 9, borderRadius: 5, overflow: "hidden", gap: 1.5 }}>
        {categorias.map((c) => (
          <div
            key={c.clave}
            title={categoria(c.clave).label}
            style={{ width: `${(c.total / total) * 100}%`, background: categoria(c.clave).color }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 9 }}>
        {categorias.slice(0, 4).map((c) => (
          <span key={c.clave} style={{ fontSize: 11.5, color: BCN.humo, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: categoria(c.clave).color }} />
            {categoria(c.clave).label} {eurosCorto(c.total)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Una línea de gasto ───────────────────────────────────── */

function FilaGasto({ gasto, primera, onClick }: { gasto: Gasto; primera: boolean; onClick: () => void }) {
  const cat = categoria(gasto.categoria);
  const esAportacion = gasto.tipo === "aportacion";

  const dePagador =
    gasto.pagado_por === "bote" ? "Del bote"
    : gasto.pagado_por === "alejandro" ? "Alejandro"
    : "Rut";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "11px 14px",
        background: "white", border: "none", cursor: "pointer", textAlign: "left",
        borderTop: primera ? "none" : `1px solid ${BCN.arena}`,
      }}
    >
      <span style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 10,
        background: esAportacion ? `${BCN.oliva}1E` : `${cat.color}18`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
        opacity: gasto.personal ? 0.55 : 1,
      }}>
        {esAportacion ? "＋" : cat.icon}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block", fontSize: 14.5, color: BCN.tinta, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {gasto.concepto}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, marginTop: 1 }}>
          {dePagador}
          {gasto.medio === "efectivo" ? " · 💵" : gasto.medio === "tarjeta" ? " · 💳" : ""}
          {gasto.personal ? " · suyo" : ""}
          {gasto.fijo_id ? " · fijo" : ""}
          {gasto.ticket_url ? " · 🧾" : ""}
        </span>
      </span>

      <span style={{
        fontSize: 14.5, fontWeight: 700, flexShrink: 0,
        color: esAportacion ? BCN.oliva : BCN.tinta,
        fontVariantNumeric: "tabular-nums",
      }}>
        {esAportacion ? "+" : "−"}{euros(Number(gasto.importe))}
      </span>
    </button>
  );
}

function FilaFijo({ fijo, botes, onEditar }: { fijo: GastoFijo; botes: Bote[]; onEditar: () => void }) {
  const cat = categoria(fijo.categoria);
  const bote = botes.find((b) => b.id === fijo.bote_id);

  return (
    <button
      onClick={onEditar}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "13px 15px",
        background: "white", borderRadius: 13, cursor: "pointer", textAlign: "left",
        border: `1px solid ${BCN.arenaOsc}`, opacity: fijo.activo ? 1 : 0.5,
      }}
    >
      <span style={{
        width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: `${cat.color}18`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
      }}>
        {cat.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, color: BCN.tinta, fontWeight: 500 }}>
          {fijo.concepto}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, marginTop: 1 }}>
          Cada día {fijo.dia}
          {fijo.pagado_por === "bote" ? ` · ${bote?.nombre ?? "del bote"}` : ` · lo paga ${fijo.pagado_por === "alejandro" ? "Alejandro" : "Rut"}`}
          {fijo.medio === "efectivo" ? " · 💵" : fijo.medio === "tarjeta" ? " · 💳" : ""}
          {!fijo.activo ? " · pausado" : ""}
        </span>
      </span>
      <span style={{ fontSize: 14.5, fontWeight: 700, color: BCN.tinta, fontVariantNumeric: "tabular-nums" }}>
        {euros(Number(fijo.importe))}
      </span>
    </button>
  );
}

/* ─── Anotar un gasto ──────────────────────────────────────── */

function HojaGasto({ abierta, gasto, etapaId, botes, usuario, recargar, onCerrar, onGuardado }: {
  abierta: boolean; gasto: Gasto | null; etapaId: string | null; botes: Bote[];
  usuario: string;
  /** Si se ha entrado tocando un bote, se abre listo para meterle dinero. */
  recargar?: string | null;
  onCerrar: () => void; onGuardado: () => void;
}) {
  const [tipo, setTipo] = useState<"gasto" | "aportacion">("gasto");
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [pagadoPor, setPagadoPor] = useState<FormaPago>("bote");
  const [boteId, setBoteId] = useState("");
  const [cat, setCat] = useState("comida");
  const [personal, setPersonal] = useState(false);
  const [medio, setMedio] = useState<Medio>(null);
  const [repetir, setRepetir] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const visor = useVisor();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierta) return;
    setTipo(gasto?.tipo ?? (recargar ? "aportacion" : "gasto"));
    setConcepto(gasto?.concepto ?? "");
    setImporte(gasto ? String(gasto.importe) : "");
    setFecha(gasto?.fecha ?? hoyISO());
    setPagadoPor(gasto?.pagado_por ?? "bote");
    setBoteId(gasto?.bote_id ?? recargar ?? botes[0]?.id ?? "");
    setCat(gasto?.categoria ?? "comida");
    setPersonal(gasto?.personal ?? false);
    setMedio(gasto?.medio ?? null);
    setRepetir(false);
    setTicket(gasto?.ticket_url ?? null);
    setNota(gasto?.nota ?? "");
  }, [abierta, gasto, botes, recargar]);

  const subirTicket = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    const url = await uploadPhoto(file, "barcelona-tickets");
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
    if (url) setTicket(url);
  };

  const cantidad = Number(importe.replace(",", "."));
  const valido = concepto.trim().length > 0 && Number.isFinite(cantidad) && cantidad > 0;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    const campos = {
      fecha,
      concepto: concepto.trim(),
      importe: cantidad,
      tipo,
      // Meter dinero siempre lo hace una persona; gastar puede hacerlo el bote
      pagado_por: tipo === "aportacion" && pagadoPor === "bote" ? "alejandro" : pagadoPor,
      bote_id: tipo === "aportacion" || pagadoPor === "bote" ? (boteId || null) : null,
      categoria: tipo === "aportacion" ? "otros" : cat,
      // Lo personal solo tiene sentido si lo paga una persona
      personal: tipo === "gasto" && pagadoPor !== "bote" ? personal : false,
      medio: tipo === "gasto" ? medio : null,
      ticket_url: ticket,
      nota: nota.trim() || null,
    };
    if (gasto) {
      await updateGasto(gasto.id, campos);
    } else if (etapaId) {
      const creado = await addGasto(etapaId, campos);

      // Marcado como fijo: se da de alta para que vuelva cada mes, y el
      // que acabamos de apuntar queda como el de este mes para que no
      // salga dos veces.
      if (repetir && creado) {
        const periodo = fecha.slice(0, 7);
        const nuevoFijo = await addFijo(etapaId, {
          concepto: campos.concepto,
          importe: campos.importe,
          dia: Number(fecha.slice(8, 10)),
          pagado_por: campos.pagado_por as FormaPago,
          bote_id: campos.bote_id,
          personal: campos.personal,
          medio: campos.medio,
          categoria: campos.categoria,
          activo: true,
          desde: fecha,
        });
        if (nuevoFijo) {
          await updateGasto(creado.id, { fijo_id: nuevoFijo.id, fijo_periodo: periodo });
        }
      }

      avisar(
        usuario,
        tipo === "aportacion" ? "aportacion" : "gasto",
        campos.concepto,
        euros(campos.importe)
      );
    }
    setGuardando(false);
    onGuardado();
  };

  const borrar = async () => {
    if (!gasto) return;
    if (!confirm(`¿Borrar "${gasto.concepto}"?`)) return;
    await deleteGasto(gasto.id);
    onGuardado();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={gasto ? "Editar" : tipo === "aportacion" ? "Meter dinero" : "Anotar gasto"}>
      {/* Gastar o meter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {([
          ["gasto", "Un gasto", "🧾"],
          ["aportacion", "Meter dinero", "＋"],
        ] as ["gasto" | "aportacion", string, string][]).map(([v, etiqueta, icono]) => (
          <button
            key={v}
            onClick={() => setTipo(v)}
            style={{
              flex: 1, padding: "13px 10px", borderRadius: 14, cursor: "pointer",
              border: `1.5px solid ${tipo === v ? (v === "gasto" ? BCN.teja : BCN.oliva) : BCN.arenaOsc}`,
              background: tipo === v ? (v === "gasto" ? BCN.teja : BCN.oliva) : "white",
              color: tipo === v ? "white" : BCN.tinta,
              fontSize: 13.5, fontWeight: tipo === v ? 700 : 500,
            }}
          >
            <span style={{ fontSize: 17, display: "block", marginBottom: 3 }}>{icono}</span>
            {etiqueta}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1.6 }}>
          <Campo label="Qué">
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={tipo === "aportacion" ? "Ingreso de agosto" : "Compra del súper"}
              style={estiloInput}
            />
          </Campo>
        </div>
        <div style={{ flex: 1 }}>
          <Campo label="Cuánto">
            <input
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              style={{ ...estiloInput, fontWeight: 700 }}
            />
          </Campo>
        </div>
      </div>

      <Campo label={tipo === "aportacion" ? "¿Quién lo mete?" : "¿De dónde sale?"}>
        <div style={{ display: "flex", gap: 8 }}>
          {(tipo === "aportacion"
            ? (["alejandro", "rut"] as FormaPago[])
            : (["bote", "alejandro", "rut"] as FormaPago[])
          ).map((p) => {
            const activo = pagadoPor === p;
            const etiqueta = p === "bote" ? "El bote" : p === "alejandro" ? "Alejandro" : "Rut";
            const color = p === "bote" ? BCN.oliva : p === "alejandro" ? BCN.mar : BCN.teja;
            return (
              <button
                key={p}
                onClick={() => setPagadoPor(p)}
                style={{
                  flex: 1, padding: "11px 8px", borderRadius: 12, cursor: "pointer",
                  border: `1.5px solid ${activo ? color : BCN.arenaOsc}`,
                  background: activo ? `${color}14` : "white",
                  color: activo ? color : BCN.humo,
                  fontSize: 13.5, fontWeight: activo ? 700 : 500,
                }}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
        {tipo === "gasto" && pagadoPor === "bote" && (
          <p style={{ fontSize: 12, color: BCN.humo, margin: "7px 0 0", lineHeight: 1.5 }}>
            Sale de la caja común, así que es de los dos.
          </p>
        )}
        {tipo === "gasto" && pagadoPor !== "bote" && !personal && (
          <p style={{ fontSize: 12, color: BCN.humo, margin: "7px 0 0", lineHeight: 1.5 }}>
            Lo adelanta {pagadoPor === "alejandro" ? "Alejandro" : "Rut"} por los dos.
          </p>
        )}
      </Campo>

      {tipo === "gasto" && pagadoPor !== "bote" && (
        <button
          onClick={() => setPersonal(!personal)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "12px 14px", borderRadius: 12, marginBottom: 16, cursor: "pointer",
            border: `1.5px solid ${personal ? BCN.sol : BCN.arenaOsc}`,
            background: personal ? `${BCN.sol}14` : "white",
          }}
        >
          <span style={{ fontSize: 16 }}>{personal ? "🙋" : "👥"}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: BCN.tinta }}>
              {personal ? "Es una cosa suya" : "Es de los dos"}
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, marginTop: 2, lineHeight: 1.4 }}>
              {personal
                ? "Se apunta para saberlo, pero no cuenta en el reparto."
                : "Lo adelanta uno y el otro le debe su mitad."}
            </span>
          </span>
        </button>
      )}

      {botes.length > 1 && (tipo === "aportacion" || pagadoPor === "bote") && (
        <Campo label="¿Qué bote?">
          <select value={boteId} onChange={(e) => setBoteId(e.target.value)} style={estiloInput}>
            {botes.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
      )}

      {tipo === "gasto" && (
        <Campo label="Categoría">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(CATEGORIAS).map(([clave, c]) => {
              const activo = cat === clave;
              return (
                <button
                  key={clave}
                  onClick={() => setCat(clave)}
                  style={{
                    padding: "7px 12px", borderRadius: 16, cursor: "pointer", fontSize: 12.5,
                    border: `1px solid ${activo ? c.color : BCN.arenaOsc}`,
                    background: activo ? `${c.color}18` : "white",
                    color: activo ? c.color : BCN.humo,
                    fontWeight: activo ? 600 : 500,
                  }}
                >
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
        </Campo>
      )}

      {tipo === "gasto" && (
        <Campo label="¿Con qué se pagó?">
          <div style={{ display: "flex", gap: 8 }}>
            {([
              [null, "No importa", "—"],
              ["efectivo", "Efectivo", "💵"],
              ["tarjeta", "Tarjeta", "💳"],
            ] as [Medio, string, string][]).map(([m, etiqueta, icono]) => {
              const act = medio === m;
              return (
                <button
                  key={etiqueta}
                  onClick={() => setMedio(m)}
                  style={{
                    flex: 1, padding: "10px 6px", borderRadius: 12, cursor: "pointer",
                    border: `1.5px solid ${act ? BCN.mar : BCN.arenaOsc}`,
                    background: act ? `${BCN.mar}12` : "white",
                    color: act ? BCN.mar : BCN.humo,
                    fontSize: 12.5, fontWeight: act ? 700 : 500,
                  }}
                >
                  <span style={{ fontSize: 15, display: "block", marginBottom: 2 }}>{icono}</span>
                  {etiqueta}
                </button>
              );
            })}
          </div>
        </Campo>
      )}

      <Campo label="Fecha">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={estiloInput} />
      </Campo>

      {tipo === "gasto" && !gasto && (
        <button
          onClick={() => setRepetir(!repetir)}
          style={{
            display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
            padding: "13px 14px", borderRadius: 12, marginBottom: 16, cursor: "pointer",
            border: `1.5px solid ${repetir ? BCN.teja : BCN.arenaOsc}`,
            background: repetir ? `${BCN.teja}12` : "white",
          }}
        >
          <span style={{
            width: 42, height: 25, borderRadius: 13, flexShrink: 0, position: "relative",
            background: repetir ? BCN.teja : BCN.arenaOsc, transition: "background .18s",
          }}>
            <span style={{
              position: "absolute", top: 3, left: repetir ? 20 : 3,
              width: 19, height: 19, borderRadius: "50%", background: "white",
              transition: "left .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: BCN.tinta }}>
              Se repite cada mes
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: BCN.humo, marginTop: 2, lineHeight: 1.4 }}>
              {repetir
                ? `Volverá a apuntarse solo cada día ${Number(fecha.slice(8, 10))}`
                : "Para el alquiler, la luz, el móvil…"}
            </span>
          </span>
        </button>
      )}

      {tipo === "gasto" && (
        <Campo label="Ticket">
          {ticket ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={ticket} alt="Ticket" onClick={() => visor.abrir(0)} style={{
                width: 108, height: 140, objectFit: "cover", borderRadius: 11,
                border: `1px solid ${BCN.arenaOsc}`, display: "block", cursor: "zoom-in",
              }} />
              <button
                onClick={() => setTicket(null)}
                aria-label="Quitar el ticket"
                style={{
                  position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: "50%",
                  border: "none", background: "rgba(0,0,0,0.55)", color: "white",
                  fontSize: 14, cursor: "pointer", lineHeight: 1, padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              style={{
                width: "100%", padding: "14px", borderRadius: 12, cursor: "pointer",
                border: `1.5px dashed ${BCN.arenaOsc}`, background: "transparent",
                color: BCN.humo, fontSize: 14,
              }}
            >
              {subiendo ? "Subiendo…" : "📷 Hacer foto al ticket"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={subirTicket}
            style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
          />
        </Campo>
      )}

      <Campo label="Nota">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Opcional"
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }}
        />
      </Campo>

      <Boton onClick={guardar} disabled={!valido || guardando} color={tipo === "aportacion" ? BCN.oliva : BCN.tinta}>
        {guardando ? "Guardando…" : gasto ? "Guardar cambios" : tipo === "aportacion" ? "Meter en el bote" : "Anotar"}
      </Boton>

      {gasto && (
        <button
          onClick={borrar}
          style={{
            width: "100%", marginTop: 10, padding: "12px", borderRadius: 12,
            border: "none", background: "transparent", color: BCN.teja,
            fontSize: 13.5, cursor: "pointer",
          }}
        >
          Borrar
        </button>
      )}

      <Visor fotos={ticket ? [ticket] : []} indice={visor.indice} onCerrar={visor.cerrar} />
    </Hoja>
  );
}

/* ─── Un gasto fijo ────────────────────────────────────────── */

function HojaFijo({ abierta, fijo, etapaId, botes, onCerrar, onGuardado }: {
  abierta: boolean; fijo: GastoFijo | null; etapaId: string | null; botes: Bote[];
  onCerrar: () => void; onGuardado: () => void;
}) {
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [dia, setDia] = useState("1");
  const [pagadoPor, setPagadoPor] = useState<FormaPago>("bote");
  const [boteId, setBoteId] = useState("");
  const [cat, setCat] = useState("casa");
  const [personal, setPersonal] = useState(false);
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    setConcepto(fijo?.concepto ?? "");
    setImporte(fijo ? String(fijo.importe) : "");
    setDia(String(fijo?.dia ?? 1));
    setPagadoPor(fijo?.pagado_por ?? "bote");
    setBoteId(fijo?.bote_id ?? botes[0]?.id ?? "");
    setCat(fijo?.categoria ?? "casa");
    setPersonal(fijo?.personal ?? false);
    setActivo(fijo?.activo ?? true);
  }, [abierta, fijo, botes]);

  const cantidad = Number(importe.replace(",", "."));
  const valido = concepto.trim().length > 0 && Number.isFinite(cantidad) && cantidad > 0;

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    const campos = {
      concepto: concepto.trim(),
      importe: cantidad,
      dia: Math.min(31, Math.max(1, Number(dia) || 1)),
      pagado_por: pagadoPor,
      bote_id: pagadoPor === "bote" ? (boteId || null) : null,
      categoria: cat,
      personal: pagadoPor !== "bote" ? personal : false,
      activo,
    };
    if (fijo) await updateFijo(fijo.id, campos);
    else if (etapaId) await addFijo(etapaId, campos);
    setGuardando(false);
    onGuardado();
  };

  const borrar = async () => {
    if (!fijo) return;
    if (!confirm(`¿Quitar "${fijo.concepto}" de los fijos?\n\nLo ya apuntado se queda.`)) return;
    await deleteFijo(fijo.id);
    onGuardado();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={fijo ? "Editar gasto fijo" : "Nuevo gasto fijo"}>
      <p style={{ fontSize: 13, color: BCN.humo, margin: "-10px 0 16px", lineHeight: 1.55 }}>
        Se apunta solo cada mes. Si la factura viene distinta, cambiad el importe aquí
        y a partir del mes que viene entra con el nuevo.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1.6 }}>
          <Campo label="Qué">
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)}
              placeholder="Alquiler" style={estiloInput} />
          </Campo>
        </div>
        <div style={{ flex: 1 }}>
          <Campo label="Cuánto">
            <input value={importe} onChange={(e) => setImporte(e.target.value)}
              placeholder="0,00" inputMode="decimal" style={{ ...estiloInput, fontWeight: 700 }} />
          </Campo>
        </div>
      </div>

      <Campo label="Qué día de cada mes">
        <input type="number" min={1} max={31} value={dia}
          onChange={(e) => setDia(e.target.value)} inputMode="numeric" style={estiloInput} />
      </Campo>

      <Campo label="¿De dónde sale?">
        <div style={{ display: "flex", gap: 8 }}>
          {(["bote", "alejandro", "rut"] as FormaPago[]).map((p) => {
            const act = pagadoPor === p;
            const etiqueta = p === "bote" ? "El bote" : p === "alejandro" ? "Alejandro" : "Rut";
            const color = p === "bote" ? BCN.oliva : p === "alejandro" ? BCN.mar : BCN.teja;
            return (
              <button key={p} onClick={() => setPagadoPor(p)}
                style={{
                  flex: 1, padding: "11px 8px", borderRadius: 12, cursor: "pointer",
                  border: `1.5px solid ${act ? color : BCN.arenaOsc}`,
                  background: act ? `${color}14` : "white",
                  color: act ? color : BCN.humo,
                  fontSize: 13.5, fontWeight: act ? 700 : 500,
                }}>
                {etiqueta}
              </button>
            );
          })}
        </div>
      </Campo>

      {botes.length > 1 && pagadoPor === "bote" && (
        <Campo label="¿Qué bote?">
          <select value={boteId} onChange={(e) => setBoteId(e.target.value)} style={estiloInput}>
            {botes.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
      )}

      <Campo label="Categoría">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(CATEGORIAS).map(([clave, c]) => {
            const act = cat === clave;
            return (
              <button key={clave} onClick={() => setCat(clave)}
                style={{
                  padding: "7px 12px", borderRadius: 16, cursor: "pointer", fontSize: 12.5,
                  border: `1px solid ${act ? c.color : BCN.arenaOsc}`,
                  background: act ? `${c.color}18` : "white",
                  color: act ? c.color : BCN.humo,
                  fontWeight: act ? 600 : 500,
                }}>
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
      </Campo>

      {pagadoPor !== "bote" && (
        <button
          onClick={() => setPersonal(!personal)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "12px 14px", borderRadius: 12, marginBottom: 12, cursor: "pointer",
            border: `1.5px solid ${personal ? BCN.sol : BCN.arenaOsc}`,
            background: personal ? `${BCN.sol}14` : "white",
          }}
        >
          <span style={{ fontSize: 16 }}>{personal ? "🙋" : "👥"}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: BCN.tinta }}>
            {personal ? "Es una cosa suya" : "Es de los dos"}
          </span>
        </button>
      )}

      <button
        onClick={() => setActivo(!activo)}
        style={{
          display: "flex", alignItems: "center", gap: 9, width: "100%",
          padding: "12px 14px", borderRadius: 12, marginBottom: 16, cursor: "pointer",
          border: `1.5px solid ${activo ? BCN.oliva : BCN.arenaOsc}`,
          background: activo ? `${BCN.oliva}12` : "white",
          color: activo ? BCN.oliva : BCN.humo,
          fontSize: 14, fontWeight: 600,
        }}
      >
        <span>{activo ? "▶" : "⏸"}</span>
        {activo ? "Activo: se apunta cada mes" : "Pausado: no se apunta"}
      </button>

      <Boton onClick={guardar} disabled={!valido || guardando} color={BCN.tinta}>
        {guardando ? "Guardando…" : fijo ? "Guardar cambios" : "Añadir gasto fijo"}
      </Boton>

      {fijo && (
        <button onClick={borrar}
          style={{
            width: "100%", marginTop: 10, padding: "12px", borderRadius: 12,
            border: "none", background: "transparent", color: BCN.teja,
            fontSize: 13.5, cursor: "pointer",
          }}>
          Quitar de los fijos
        </button>
      )}
    </Hoja>
  );
}

/* ─── Un bote nuevo ────────────────────────────────────────── */

function HojaBote({ abierta, etapaId, onCerrar, onGuardado }: {
  abierta: boolean; etapaId: string | null; onCerrar: () => void; onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<string>(BCN.teja);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    setNombre(""); setColor(BCN.teja);
  }, [abierta]);

  const guardar = async () => {
    if (!nombre.trim() || !etapaId || guardando) return;
    setGuardando(true);
    await addBote(etapaId, { nombre: nombre.trim(), color });
    setGuardando(false);
    onGuardado();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Nuevo bote">
      <p style={{ fontSize: 13, color: BCN.humo, margin: "-10px 0 16px", lineHeight: 1.55 }}>
        Una hucha común: metéis dinero y de ahí van saliendo los gastos.
        Cuando baje, se recarga.
      </p>

      <Campo label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Bote de agosto" style={estiloInput} />
      </Campo>

      <Campo label="Color">
        <div style={{ display: "flex", gap: 9 }}>
          {[BCN.teja, BCN.mar, BCN.oliva, BCN.sol, BCN.tejaOsc, BCN.marClaro].map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`}
              style={{
                width: 38, height: 38, borderRadius: "50%", background: c, cursor: "pointer",
                border: color === c ? `3px solid ${BCN.tinta}` : "2px solid transparent",
              }} />
          ))}
        </div>
      </Campo>

      <Boton onClick={guardar} disabled={!nombre.trim() || guardando} color={BCN.tinta}>
        {guardando ? "Creando…" : "Crear bote"}
      </Boton>
    </Hoja>
  );
}
