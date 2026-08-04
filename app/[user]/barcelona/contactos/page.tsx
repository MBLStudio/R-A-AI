"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_CONTACTO, type Contacto, type TipoContacto, type Etapa } from "@/lib/barcelona/types";
import { getEtapaActiva, getContactos, addContacto, updateContacto, deleteContacto } from "@/lib/barcelona/queries";
import { Pantalla, Vacio, Hoja, Campo, estiloInput, Boton, Selector, IconoMas } from "@/components/barcelona/Shell";

const TIPOS: TipoContacto[] = ["inmobiliaria", "propietario", "empresa", "amigo", "conocido", "otro"];

export default function ContactosPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Contacto | "nuevo" | null>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    setEtapa(e);
    setContactos(await getContactos(e.id));
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const grupos = TIPOS
    .map((t) => ({ tipo: t, items: contactos.filter((c) => c.tipo === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <Pantalla
      titulo="Contactos"
      subtitulo={contactos.length > 0 ? `${contactos.length} ${contactos.length === 1 ? "persona" : "personas"}` : "Quién os ayudó"}
      color={BCN.humo}
      accion={{ icon: IconoMas, label: "Añadir contacto", onClick: () => setEditando("nuevo") }}
    >
      {cargando ? (
        <Cargando />
      ) : contactos.length === 0 ? (
        <Vacio
          icon="📇"
          titulo="Sin contactos todavía"
          texto="La agente que os enseñó dos pisos, el propietario majo, el amigo de un amigo. Dentro de un año lo agradeceréis."
          accion={{ label: "Añadir el primero", onClick: () => setEditando("nuevo") }}
        />
      ) : (
        grupos.map((g) => (
          <div key={g.tipo} style={{ marginBottom: 22 }}>
            <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
              {TIPO_CONTACTO[g.tipo].icon} {TIPO_CONTACTO[g.tipo].label}
            </p>
            {g.items.map((c, i) => (
              <Ficha
                key={c.id} contacto={c} delay={i * 0.04}
                onEditar={() => setEditando(c)}
                onFavorito={async () => { await updateContacto(c.id, { favorito: !c.favorito }); await cargar(); }}
              />
            ))}
          </div>
        ))
      )}

      <HojaContacto
        contacto={editando}
        etapaId={etapa?.id ?? null}
        onCerrar={() => setEditando(null)}
        onGuardado={async () => { setEditando(null); await cargar(); }}
        onBorrar={async (id) => { await deleteContacto(id); setEditando(null); await cargar(); }}
      />
    </Pantalla>
  );
}

function Ficha({ contacto, delay, onEditar, onFavorito }: {
  contacto: Contacto; delay: number; onEditar: () => void; onFavorito: () => void;
}) {
  const inicial = contacto.nombre.trim()[0]?.toUpperCase() ?? "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}
      style={{
        background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 16,
        padding: "14px 16px", marginBottom: 8, display: "flex", gap: 13, alignItems: "flex-start",
        boxShadow: "0 2px 8px rgba(44,36,32,0.04)",
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${BCN.mar} 0%, ${BCN.marClaro} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Georgia, serif", fontSize: 18, color: "white",
      }}>
        {inicial}
      </div>

      <button onClick={onEditar}
        style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
        <p style={{ fontSize: 15.5, fontWeight: 600, color: BCN.tinta, margin: 0 }}>{contacto.nombre}</p>
        {contacto.empresa && <p style={{ fontSize: 12.5, color: BCN.humo, margin: "2px 0 0" }}>{contacto.empresa}</p>}
        {contacto.notas && (
          <p style={{ fontSize: 13.5, color: BCN.tinta, margin: "7px 0 0", lineHeight: 1.5, opacity: 0.82, fontStyle: "italic" }}>
            "{contacto.notas}"
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: contacto.notas ? 9 : 7, flexWrap: "wrap" }}>
          {contacto.telefono && (
            <a href={`tel:${contacto.telefono}`} onClick={(e) => e.stopPropagation()}
              style={enlace}>📞 {contacto.telefono}</a>
          )}
          {contacto.email && (
            <a href={`mailto:${contacto.email}`} onClick={(e) => e.stopPropagation()}
              style={enlace}>✉️ Email</a>
          )}
        </div>
      </button>

      <button onClick={onFavorito} aria-label="Marcar favorito"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 17, padding: 2, flexShrink: 0, opacity: contacto.favorito ? 1 : 0.3 }}>
        {contacto.favorito ? "⭐" : "☆"}
      </button>
    </motion.div>
  );
}

function HojaContacto({ contacto, etapaId, onCerrar, onGuardado, onBorrar }: {
  contacto: Contacto | "nuevo" | null; etapaId: string | null;
  onCerrar: () => void; onGuardado: () => void; onBorrar: (id: string) => void;
}) {
  const esNuevo = contacto === "nuevo";
  const actual = esNuevo ? null : contacto;

  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoContacto>("inmobiliaria");
  const [empresa, setEmpresa] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!contacto) return;
    setNombre(actual?.nombre ?? "");
    setTipo(actual?.tipo ?? "inmobiliaria");
    setEmpresa(actual?.empresa ?? "");
    setTelefono(actual?.telefono ?? "");
    setEmail(actual?.email ?? "");
    setNotas(actual?.notas ?? "");
  }, [contacto, actual]);

  const guardar = async () => {
    if (!etapaId || !nombre.trim()) return;
    setGuardando(true);
    const campos = {
      nombre: nombre.trim(),
      tipo,
      empresa: empresa.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      notas: notas.trim() || null,
    };
    if (actual) await updateContacto(actual.id, campos);
    else await addContacto(etapaId, campos);
    setGuardando(false);
    onGuardado();
  };

  return (
    <Hoja abierta={!!contacto} onCerrar={onCerrar} titulo={esNuevo ? "Añadir contacto" : "Editar contacto"}>
      <Campo label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="María" style={estiloInput} />
      </Campo>

      <Campo label="¿Quién es?">
        <Selector valor={tipo} onChange={setTipo} color={BCN.mar}
          opciones={TIPOS.map((t) => ({ valor: t, label: TIPO_CONTACTO[t].label, icon: TIPO_CONTACTO[t].icon }))} />
      </Campo>

      <Campo label="Empresa">
        <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Fincas Sant Antoni" style={estiloInput} />
      </Campo>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Campo label="Teléfono">
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" style={estiloInput} />
        </Campo></div>
        <div style={{ flex: 1 }}><Campo label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@…" style={estiloInput} />
        </Campo></div>
      </div>

      <Campo label="Notas">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
          placeholder="Nos enseñó dos pisos. Muy amable."
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>

      <Boton onClick={guardar} disabled={!nombre.trim() || guardando} color={BCN.mar}>
        {guardando ? "Guardando…" : esNuevo ? "Guardar contacto" : "Guardar cambios"}
      </Boton>

      {actual && (
        <button onClick={() => onBorrar(actual.id)}
          style={{ width: "100%", marginTop: 9, padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${BCN.arenaOsc}`, color: BCN.humo, fontSize: 13.5, cursor: "pointer" }}>
          Borrar contacto
        </button>
      )}
    </Hoja>
  );
}

function Cargando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 74, borderRadius: 16, background: BCN.arenaOsc }} />
      ))}
    </div>
  );
}

const enlace: React.CSSProperties = {
  fontSize: 12, color: BCN.mar, textDecoration: "none",
  background: `${BCN.mar}12`, padding: "4px 9px", borderRadius: 12,
};
