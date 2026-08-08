"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import {
  BCN, TIPO_CONTACTO, colorDeContacto, inicialDe, pintarMomento,
  type Contacto, type TipoContacto, type Etapa, type Momento,
} from "@/lib/barcelona/types";
import {
  getEtapaActiva, getContactos, addContacto, updateContacto, deleteContacto,
  getMomentosPorContacto,
} from "@/lib/barcelona/queries";
import { Pantalla, Vacio, Hoja, Campo, estiloInput, Boton, IconoMas } from "@/components/barcelona/Shell";

/* ═══════════════════════════════════════════════════════════
   Contactos.

   La agenda de quien os está ayudando a mudaros: la de la
   inmobiliaria, el casero, el amigo que os presta la furgo.

   Se lee como la agenda del móvil —inicial, orden alfabético,
   nada de ruido— y al desplegar cada uno están sus datos y
   todo lo que habéis hecho con él.
   ═══════════════════════════════════════════════════════════ */

type Filtro = "todos" | TipoContacto;

export default function ContactosPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [momentos, setMomentos] = useState<Record<string, Momento[]>>({});
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Contacto | "nuevo" | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);
    const [lista, porContacto] = await Promise.all([
      getContactos(e.id),
      getMomentosPorContacto(e.id),
    ]);
    setContactos(lista);
    setMomentos(porContacto);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  /** Filtrados, ordenados y repartidos por letra, como la agenda del móvil. */
  const letras = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const visibles = contactos
      .filter((c) => filtro === "todos" || c.tipo === filtro)
      .filter((c) =>
        !texto ||
        c.nombre.toLowerCase().includes(texto) ||
        (c.empresa ?? "").toLowerCase().includes(texto) ||
        (c.telefono ?? "").includes(texto)
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

    const mapa = new Map<string, Contacto[]>();
    for (const c of visibles) {
      const letra = inicialDe(c.nombre);
      if (!mapa.has(letra)) mapa.set(letra, []);
      mapa.get(letra)!.push(c);
    }
    return [...mapa.entries()];
  }, [contactos, filtro, busqueda]);

  const cuantos = contactos.length;

  return (
    <Pantalla
      titulo="Contactos"
      subtitulo={cuantos > 0 ? `${cuantos} ${cuantos === 1 ? "contacto" : "contactos"}` : "Quién os está ayudando"}
      color={BCN.humo}
      accion={{ icon: IconoMas, label: "Añadir contacto", onClick: () => setEditando("nuevo") }}
    >
      {cargando ? (
        <p style={{ textAlign: "center", color: BCN.humo, fontSize: 14, padding: "40px 0" }}>Un momento…</p>
      ) : cuantos === 0 ? (
        <Vacio
          icon="📇"
          titulo="Todavía no hay nadie"
          texto="La de la inmobiliaria, el casero, quien os enseñó el barrio. Aquí queda con lo que hicisteis juntos."
          accion={{ label: "Añadir el primero", onClick: () => setEditando("nuevo") }}
        />
      ) : (
        <>
          {/* Buscador */}
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar"
            style={{
              ...estiloInput,
              marginBottom: 12, background: "white",
              border: `1px solid ${BCN.arenaOsc}`,
            }}
          />

          {/* Persona o empresa */}
          <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
            {([
              ["todos", "Todos", cuantos],
              ["persona", TIPO_CONTACTO.persona.plural, contactos.filter((c) => c.tipo === "persona").length],
              ["empresa", TIPO_CONTACTO.empresa.plural, contactos.filter((c) => c.tipo === "empresa").length],
            ] as [Filtro, string, number][]).map(([clave, etiqueta, n]) => (
              <button
                key={clave}
                onClick={() => setFiltro(clave)}
                style={{
                  flex: 1, padding: "9px 6px", borderRadius: 11, cursor: "pointer",
                  border: `1px solid ${filtro === clave ? BCN.tinta : BCN.arenaOsc}`,
                  background: filtro === clave ? BCN.tinta : "white",
                  color: filtro === clave ? "white" : BCN.humo,
                  fontSize: 13, fontWeight: filtro === clave ? 700 : 500,
                }}
              >
                {etiqueta} <span style={{ opacity: 0.65, fontSize: 12 }}>{n}</span>
              </button>
            ))}
          </div>

          {letras.length === 0 ? (
            <p style={{ textAlign: "center", color: BCN.humo, fontSize: 14, padding: "36px 0" }}>
              Nadie por aquí.
            </p>
          ) : (
            <div style={{ background: "white", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, overflow: "hidden" }}>
              {letras.map(([letra, gente]) => (
                <div key={letra}>
                  <div style={{
                    padding: "7px 16px", background: BCN.arena,
                    fontSize: 11.5, fontWeight: 800, color: BCN.humo, letterSpacing: "0.06em",
                  }}>
                    {letra}
                  </div>
                  {gente.map((c) => (
                    <Fila
                      key={c.id}
                      contacto={c}
                      momentos={momentos[c.id] ?? []}
                      abierto={abierto === c.id}
                      onToggle={() => setAbierto(abierto === c.id ? null : c.id)}
                      onEditar={() => setEditando(c)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <HojaContacto
        abierta={editando !== null}
        contacto={editando === "nuevo" ? null : editando}
        etapaId={etapa?.id ?? null}
        onCerrar={() => setEditando(null)}
        onGuardado={async () => { setEditando(null); await cargar(); }}
        onBorrado={async () => { setEditando(null); setAbierto(null); await cargar(); }}
      />
    </Pantalla>
  );
}

/* ─── Una línea de la agenda ───────────────────────────────── */

function Fila({ contacto, momentos, abierto, onToggle, onEditar }: {
  contacto: Contacto; momentos: Momento[];
  abierto: boolean; onToggle: () => void; onEditar: () => void;
}) {
  const color = colorDeContacto(contacto.nombre);
  const esEmpresa = contacto.tipo === "empresa";

  return (
    <div style={{ borderTop: `1px solid ${BCN.arena}` }}>
      <button
        onClick={onToggle}
        aria-expanded={abierto}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "11px 16px", background: abierto ? BCN.arena : "white",
          border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{
          width: 40, height: 40, flexShrink: 0,
          // Las empresas llevan el círculo menos redondo: se distinguen sin etiqueta
          borderRadius: esEmpresa ? 12 : "50%",
          background: color, color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, fontWeight: 600, fontFamily: "Georgia, serif",
        }}>
          {inicialDe(contacto.nombre)}
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: "block", fontSize: 15.5, color: BCN.tinta, fontWeight: 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {contacto.nombre}
          </span>
          {(contacto.empresa || momentos.length > 0) && (
            <span style={{ display: "block", fontSize: 12.5, color: BCN.humo, marginTop: 1 }}>
              {[
                contacto.empresa,
                momentos.length > 0 ? `${momentos.length} ${momentos.length === 1 ? "cita" : "citas"}` : null,
              ].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>

        {contacto.favorito && <span style={{ fontSize: 13, flexShrink: 0 }}>⭐</span>}

        <motion.span
          animate={{ rotate: abierto ? 90 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ color: BCN.arenaOsc, fontSize: 17, flexShrink: 0, lineHeight: 1 }}
        >
          ›
        </motion.span>
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden", background: BCN.arena }}
          >
            <div style={{ padding: "4px 16px 16px 68px" }}>
              {contacto.telefono && (
                <Dato icono="📞" href={`tel:${contacto.telefono.replace(/\s/g, "")}`}>
                  {contacto.telefono}
                </Dato>
              )}
              {contacto.email && (
                <Dato icono="✉️" href={`mailto:${contacto.email}`}>{contacto.email}</Dato>
              )}
              {contacto.notas && (
                <p style={{ fontSize: 13.5, color: BCN.tinta, margin: "10px 0 0", lineHeight: 1.55 }}>
                  {contacto.notas}
                </p>
              )}

              {momentos.length > 0 && (
                <>
                  <p style={{
                    fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase",
                    letterSpacing: "0.1em", margin: "16px 0 8px",
                  }}>
                    Con {contacto.nombre.split(" ")[0]}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {momentos.map((m) => {
                      const cfg = pintarMomento(m.tipo, m.titulo);
                      return (
                        <div key={m.id} style={{
                          display: "flex", alignItems: "flex-start", gap: 9,
                          background: "white", borderRadius: 10, padding: "9px 11px",
                          borderLeft: `3px solid ${cfg.color}`,
                        }}>
                          <span style={{ fontSize: 14, lineHeight: 1.3 }}>{cfg.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13.5, color: BCN.tinta, margin: 0, fontWeight: 500 }}>
                              {m.titulo}
                            </p>
                            <p style={{ fontSize: 11.5, color: BCN.humo, margin: "2px 0 0" }}>
                              {new Date(m.fecha + "T12:00:00").toLocaleDateString("es-ES", {
                                day: "numeric", month: "long",
                              })}
                              {m.hora ? ` · ${m.hora.slice(0, 5)}` : ""}
                              {m.estado === "previsto" ? " · pendiente" : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {!contacto.telefono && !contacto.email && !contacto.notas && momentos.length === 0 && (
                <p style={{ fontSize: 13, color: BCN.humo, margin: "8px 0 0", fontStyle: "italic" }}>
                  Sin datos todavía.
                </p>
              )}

              <button
                onClick={onEditar}
                style={{
                  marginTop: 14, padding: "8px 16px", borderRadius: 10,
                  border: `1px solid ${BCN.arenaOsc}`, background: "white",
                  color: BCN.tinta, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Editar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Dato({ icono, href, children }: { icono: string; href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
        color: BCN.mar, fontSize: 14.5, textDecoration: "none",
      }}
    >
      <span style={{ fontSize: 13 }}>{icono}</span>
      {children}
    </a>
  );
}

/* ─── Alta y edición ───────────────────────────────────────── */

function HojaContacto({ abierta, contacto, etapaId, onCerrar, onGuardado, onBorrado }: {
  abierta: boolean; contacto: Contacto | null; etapaId: string | null;
  onCerrar: () => void; onGuardado: () => void; onBorrado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoContacto>("persona");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [favorito, setFavorito] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    setNombre(contacto?.nombre ?? "");
    setTipo(contacto?.tipo ?? "persona");
    setEmpresa(contacto?.empresa ?? "");
    setTelefono(contacto?.telefono ?? "");
    setEmail(contacto?.email ?? "");
    setNotas(contacto?.notas ?? "");
    setFavorito(contacto?.favorito ?? false);
  }, [abierta, contacto]);

  const guardar = async () => {
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    const campos = {
      nombre: nombre.trim(),
      tipo,
      empresa: empresa.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      notas: notas.trim() || null,
      favorito,
    };
    if (contacto) await updateContacto(contacto.id, campos);
    else if (etapaId) await addContacto(etapaId, campos);
    setGuardando(false);
    onGuardado();
  };

  const borrar = async () => {
    if (!contacto) return;
    if (!confirm(`¿Quitar a ${contacto.nombre} de los contactos?`)) return;
    await deleteContacto(contacto.id);
    onBorrado();
  };

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={contacto ? "Editar contacto" : "Nuevo contacto"}>
      <Campo label="Nombre">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={tipo === "empresa" ? "Fincas Gràcia" : "Marta, la del piso de Verdi"}
          style={estiloInput}
          autoCapitalize="words"
        />
      </Campo>

      <Campo label="Qué es">
        <div style={{ display: "flex", gap: 8 }}>
          {(["persona", "empresa"] as TipoContacto[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              style={{
                flex: 1, padding: "12px", borderRadius: 12, cursor: "pointer",
                border: `1.5px solid ${tipo === t ? BCN.teja : BCN.arenaOsc}`,
                background: tipo === t ? `${BCN.teja}12` : "white",
                color: tipo === t ? BCN.teja : BCN.humo,
                fontSize: 14, fontWeight: tipo === t ? 700 : 500,
              }}
            >
              {TIPO_CONTACTO[t].icon} {TIPO_CONTACTO[t].label}
            </button>
          ))}
        </div>
      </Campo>

      {tipo === "persona" && (
        <Campo label="Dónde trabaja">
          <input
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Fincas Gràcia"
            style={estiloInput}
          />
        </Campo>
      )}

      <Campo label="Teléfono">
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="600 00 00 00"
          inputMode="tel"
          style={estiloInput}
        />
      </Campo>

      <Campo label="Email">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hola@ejemplo.com"
          inputMode="email"
          autoCapitalize="off"
          style={estiloInput}
        />
      </Campo>

      <Campo label="Notas">
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Muy maja, contesta rápido por WhatsApp…"
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }}
        />
      </Campo>

      <button
        onClick={() => setFavorito(!favorito)}
        style={{
          display: "flex", alignItems: "center", gap: 9, width: "100%",
          padding: "12px 14px", borderRadius: 12, marginBottom: 16, cursor: "pointer",
          border: `1.5px solid ${favorito ? BCN.sol : BCN.arenaOsc}`,
          background: favorito ? `${BCN.sol}14` : "white",
          color: favorito ? BCN.tejaOsc : BCN.humo,
          fontSize: 14, fontWeight: favorito ? 600 : 500,
        }}
      >
        <span>{favorito ? "⭐" : "☆"}</span>
        Destacado
      </button>

      <Boton onClick={guardar} disabled={!nombre.trim() || guardando} color={BCN.tinta}>
        {guardando ? "Guardando…" : contacto ? "Guardar cambios" : "Añadir contacto"}
      </Boton>

      {contacto && (
        <button
          onClick={borrar}
          style={{
            width: "100%", marginTop: 10, padding: "12px", borderRadius: 12,
            border: "none", background: "transparent", color: BCN.teja,
            fontSize: 13.5, cursor: "pointer",
          }}
        >
          Quitar de contactos
        </button>
      )}
    </Hoja>
  );
}
