"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, pintarMomento, TIPOS_EXPERIENCIA, type Momento, type TipoMomento } from "@/lib/barcelona/types";
import { getEtapaActiva, getHistoria, formatFechaLarga } from "@/lib/barcelona/queries";
import { Pantalla, Vacio, Selector, IconoMas } from "@/components/barcelona/Shell";
import { Visor, useVisor } from "@/components/barcelona/Visor";

export default function ExperienciasPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<TipoMomento | "todas">("todas");

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const cargar = useCallback(async () => {
    const e = await getEtapaActiva();
    if (!e) { setCargando(false); return; }
    const h = await getHistoria(e.id);
    setMomentos(h.filter((m) => TIPOS_EXPERIENCIA.includes(m.tipo)));
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const tiposPresentes = TIPOS_EXPERIENCIA.filter((t) => momentos.some((m) => m.tipo === t));
  const visibles = filtro === "todas" ? momentos : momentos.filter((m) => m.tipo === filtro);

  return (
    <Pantalla
      titulo="Experiencias"
      subtitulo={momentos.length > 0 ? `${momentos.length} ${momentos.length === 1 ? "lugar guardado" : "lugares guardados"}` : "Lo que os marcó"}
      color={BCN.oliva}
      accion={{ icon: IconoMas, label: "Guardar experiencia", onClick: () => router.push(`/${user}/barcelona/momento`) }}
    >
      {cargando ? (
        <Cargando />
      ) : momentos.length === 0 ? (
        <Vacio
          icon="🍽️"
          titulo="Ningún lugar guardado aún"
          texto="Restaurantes, rooftops, playas, excursiones. Con foto y con lo que sentisteis, no solo con la dirección."
          accion={{ label: "Guardar el primero", onClick: () => router.push(`/${user}/barcelona/momento`) }}
        />
      ) : (
        <>
          {tiposPresentes.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <Selector
                valor={filtro} onChange={setFiltro} color={BCN.oliva}
                opciones={[
                  { valor: "todas" as const, label: `Todas (${momentos.length})` },
                  ...tiposPresentes.map((t) => ({
                    valor: t,
                    label: `${TIPO_MOMENTO[t].label} (${momentos.filter((m) => m.tipo === t).length})`,
                    icon: TIPO_MOMENTO[t].icon,
                  })),
                ]}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibles.map((m, i) => <Recuerdo key={m.id} momento={m} delay={i * 0.05} />)}
          </div>
        </>
      )}
    </Pantalla>
  );
}

function Recuerdo({ momento, delay }: { momento: Momento; delay: number }) {
  const cfg = pintarMomento(momento.tipo, momento.titulo);
  const [ampliada, setAmpliada] = useState(false);
  const visor = useVisor();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      style={{
        background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 18,
        overflow: "hidden", boxShadow: "0 3px 14px rgba(44,36,32,0.05)",
      }}
    >
      {momento.fotos.length > 0 && (
        <button onClick={() => setAmpliada(!ampliada)}
          style={{ display: "block", width: "100%", border: "none", padding: 0, cursor: "pointer", background: "none" }}>
          <div style={{ display: "flex", gap: 2, height: ampliada ? 260 : 170, transition: "height 0.3s" }}>
            {momento.fotos.slice(0, ampliada ? 1 : 3).map((url, i) => (
              <img key={url} src={url} alt=""
                onClick={(e) => { e.stopPropagation(); visor.abrir(i); }}
                style={{ flex: 1, height: "100%", objectFit: "cover", minWidth: 0, cursor: "zoom-in" }} />
            ))}
          </div>
        </button>
      )}

      <div style={{ padding: "15px 17px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          <span style={{ fontSize: 14 }}>{cfg.icon}</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.09em" }}>
            {cfg.label}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: BCN.humo }}>
            {formatFechaLarga(momento.fecha)}
          </span>
        </div>

        <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: BCN.tinta, margin: 0, lineHeight: 1.3 }}>
          {momento.titulo}
        </p>

        {momento.lugar && (
          <p style={{ fontSize: 12.5, color: BCN.humo, margin: "4px 0 0" }}>📍 {momento.lugar}</p>
        )}

        {momento.nota && (
          <div style={{ marginTop: 11, paddingLeft: 12, borderLeft: `3px solid ${cfg.color}44` }}>
            <p style={{ fontSize: 14.5, color: BCN.tinta, margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
              "{momento.nota}"
            </p>
          </div>
        )}
      </div>

      <Visor fotos={momento.fotos} indice={visor.indice} onCerrar={visor.cerrar} />
    </motion.div>
  );
}

function Cargando() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1].map((i) => (
        <motion.div key={i}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
          style={{ height: 250, borderRadius: 18, background: BCN.arenaOsc }} />
      ))}
    </div>
  );
}
