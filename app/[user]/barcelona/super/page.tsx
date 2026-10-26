"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN } from "@/lib/barcelona/types";
import { hoyMadrid } from "@/lib/barcelona/trabajo";
import {
  getRecetas, getLista, getNevera, getPerfiles, getEquipos, EQUIPOS_INICIALES,
  type Receta, type RecetaNueva, type ItemLista, type ItemNevera, type Perfil, type Equipo,
} from "@/lib/barcelona/super";
import { Pantalla } from "@/components/barcelona/Shell";
import { VERDE } from "@/components/barcelona/super/Comun";
import { TabHoy, type Pestana } from "@/components/barcelona/super/TabHoy";
import { TabMenu } from "@/components/barcelona/super/TabMenu";
import { TabRecetas } from "@/components/barcelona/super/TabRecetas";
import { TabCompra } from "@/components/barcelona/super/TabCompra";
import { TabNevera } from "@/components/barcelona/super/TabNevera";
import { FichaReceta } from "@/components/barcelona/super/FichaReceta";
import { HojaAjustes } from "@/components/barcelona/super/Extras";

/* ═══════════════════════════════════════════════════════════
   Supermercado — comer rico y sano sin pensarlo cada día.
   Hoy · Menú · Recetas · Compra · Nevera, todo conectado por
   el recetario.
   ═══════════════════════════════════════════════════════════ */

const PESTANAS: { valor: Pestana; label: string }[] = [
  { valor: "hoy", label: "Hoy" },
  { valor: "menu", label: "Menú" },
  { valor: "recetas", label: "Recetas" },
  { valor: "compra", label: "Compra" },
  { valor: "nevera", label: "Nevera" },
];

const CLAVE_PESTANA = "ra-super-pestana";

const IconoAjustes = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3.2" stroke="white" strokeWidth="2" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function SuperPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  useEffect(() => {
    if (user && user !== activeUser) setUser(user, user);
  }, [user, activeUser, setUser]);

  const hoy = hoyMadrid();
  const [pestana, setPestana] = useState<Pestana>("hoy");
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [lista, setLista] = useState<ItemLista[]>([]);
  const [nevera, setNevera] = useState<ItemNevera[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>(EQUIPOS_INICIALES);
  // Sube cada vez que algo cambia, para que las pestañas vuelvan a leer su parte
  const [version, setVersion] = useState(0);

  const [ficha, setFicha] = useState<Receta | null>(null);
  const [previa, setPrevia] = useState<RecetaNueva | null>(null);
  const [ajustes, setAjustes] = useState(false);

  const cargar = useCallback(async () => {
    const [r, l, n, p, e] = await Promise.all([getRecetas(), getLista(), getNevera(), getPerfiles(), getEquipos()]);
    setRecetas(r);
    setLista(l);
    setNevera(n);
    setPerfiles(p);
    setEquipos(e);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // La última pestaña se recuerda en este móvil
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(CLAVE_PESTANA) as Pestana | null;
      if (guardada && PESTANAS.some((p) => p.valor === guardada)) setPestana(guardada);
    } catch { /* sin almacenamiento: se queda en Hoy */ }
  }, []);

  const irA = (p: Pestana) => {
    setPestana(p);
    try { localStorage.setItem(CLAVE_PESTANA, p); } catch { /* da igual */ }
  };

  const cambio = useCallback(() => {
    setVersion((v) => v + 1);
    cargar();
  }, [cargar]);

  // Si la receta abierta cambia (valoración, foto, pasos), la ficha se queda con la versión nueva
  useEffect(() => {
    setFicha((f) => (f ? recetas.find((r) => r.id === f.id) ?? f : f));
  }, [recetas]);

  return (
    <>
      <Pantalla
        titulo="Supermercado"
        subtitulo="Comer rico y sano, sin pensarlo cada día"
        color={VERDE}
        accion={{ icon: IconoAjustes, onClick: () => setAjustes(true), label: "Vosotros y vuestra cocina" }}
      >
        <Pestanas valor={pestana} onChange={irA} pendientes={lista.filter((i) => !i.comprado).length} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={pestana}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}>
            {pestana === "hoy" && (
              <TabHoy hoy={hoy} quien={user} recetas={recetas} perfiles={perfiles} lista={lista} nevera={nevera}
                version={version} abrirReceta={setFicha} irA={irA} abrirAjustes={() => setAjustes(true)} />
            )}
            {pestana === "menu" && (
              <TabMenu hoy={hoy} quien={user} recetas={recetas} version={version} onCambio={cambio} abrirReceta={setFicha} />
            )}
            {pestana === "recetas" && (
              <TabRecetas recetas={recetas} quien={user} abrirReceta={setFicha} abrirPrevia={setPrevia} />
            )}
            {pestana === "compra" && (
              <TabCompra hoy={hoy} quien={user} lista={lista} recetas={recetas} nevera={nevera} onCambio={cambio} />
            )}
            {pestana === "nevera" && (
              <TabNevera hoy={hoy} quien={user} nevera={nevera} onCambio={cambio} abrirPrevia={setPrevia} />
            )}
          </motion.div>
        </AnimatePresence>
      </Pantalla>

      <FichaReceta
        receta={ficha}
        previa={ficha ? null : previa}
        quien={user}
        lista={lista}
        onCerrar={() => { setFicha(null); setPrevia(null); }}
        onCambio={cambio}
        onGuardada={(r) => { setPrevia(null); setFicha(r); }}
      />

      <HojaAjustes abierta={ajustes} perfiles={perfiles} equipos={equipos} onCerrar={() => setAjustes(false)} onCambio={cambio} />
    </>
  );
}

function Pestanas({ valor, onChange, pendientes }: { valor: Pestana; onChange: (p: Pestana) => void; pendientes: number }) {
  return (
    <div role="tablist" style={{ display: "flex", padding: 3, borderRadius: 14, background: BCN.arenaOsc, marginBottom: 16 }}>
      {PESTANAS.map((p) => {
        const activa = p.valor === valor;
        return (
          <button key={p.valor} role="tab" aria-selected={activa} onClick={() => onChange(p.valor)}
            style={{
              flex: 1, position: "relative", padding: "8px 0", border: "none", background: "transparent", cursor: "pointer",
              fontSize: 12.5, fontWeight: activa ? 700 : 500, color: activa ? BCN.tinta : BCN.humo, minWidth: 0,
            }}>
            {activa && (
              <motion.span layoutId="super-pestana" transition={{ type: "spring", stiffness: 420, damping: 34 }}
                style={{ position: "absolute", inset: 0, borderRadius: 11, background: "white", boxShadow: "0 1px 4px rgba(44,36,32,0.12)" }} />
            )}
            <span style={{ position: "relative" }}>
              {p.label}
              {p.valor === "compra" && pendientes > 0 && (
                <span style={{ marginLeft: 3, fontSize: 10, fontWeight: 800, color: "white", background: VERDE, borderRadius: 8, padding: "1px 5px" }}>
                  {pendientes}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
