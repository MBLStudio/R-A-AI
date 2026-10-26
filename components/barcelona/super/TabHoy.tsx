"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { sumarDias, fechaLarga, horaMadrid } from "@/lib/barcelona/trabajo";
import {
  getPlan, nutrientesDe, necesidades, parteComidaYCena,
  type Hueco, type Receta, type Perfil, type ItemLista, type ItemNevera,
} from "@/lib/barcelona/super";
import { Portada, Barrita, Etiqueta, VERDE } from "./Comun";
import { HojaBatch, ResumenSemanal, semanaDe } from "./Extras";

/* ═══════════════════════════════════════════════════════════
   Hoy: lo primero que veis. Qué toca cocinar esta noche (la cena
   y el tupper de mañana), cómo vais de nutrientes y atajos.
   ═══════════════════════════════════════════════════════════ */

export type Pestana = "hoy" | "menu" | "recetas" | "compra" | "nevera";

const TRUCOS = [
  "Cocina el doble de legumbre y congela la mitad: tendrás base para dos comidas más.",
  "Un puñado de espinacas en cualquier salteado suma verdura sin que se note.",
  "El arroz del tupper se recalienta mejor con una cucharada de agua por encima.",
  "Yogur natural + ajo + limón = salsa para casi todo, y con proteína.",
  "Asa una bandeja de verduras de golpe y úsala tres días: en bowls, tostas y pasta.",
  "Si cocinas pollo para la cena, haz de más: es la proteína del tupper de mañana.",
  "Las especias hacen que lo sano no sea aburrido: comino, pimentón y curry cambian un plato.",
  "Un huevo encima convierte unas verduras en una cena completa en 5 minutos.",
  "Congela el pan en rebanadas: tostadas recién hechas sin tirar nada.",
  "Los garbanzos de bote, escurridos y tostados en sartén, son un snack crujiente buenísimo.",
  "Deja el tupper de mañana en la nevera antes de cenar: así no se olvida por la mañana.",
  "Calabaza asada + batidora = crema en 10 minutos. Es temporada.",
];

function saludo(nombre: string): string {
  const h = Number(horaMadrid().slice(0, 2));
  const parte = h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  return `${parte}, ${nombre}`;
}

export function TabHoy({ hoy, quien, recetas, perfiles, lista, nevera, version, abrirReceta, irA, abrirAjustes }: {
  hoy: string;
  quien: string;
  recetas: Receta[];
  perfiles: Perfil[];
  lista: ItemLista[];
  nevera: ItemNevera[];
  version: number;
  abrirReceta: (r: Receta) => void;
  irA: (p: Pestana) => void;
  abrirAjustes: () => void;
}) {
  const manana = sumarDias(hoy, 1);
  const { lunes, dias } = semanaDe(hoy);
  const [plan, setPlan] = useState<Hueco[]>([]);
  const [cargando, setCargando] = useState(true);
  const [batch, setBatch] = useState<{ desde: string; hasta: string } | null>(null);

  const cargar = useCallback(async () => {
    const hasta = manana > dias[6] ? manana : dias[6];
    setPlan(await getPlan(lunes, hasta));
    setCargando(false);
  }, [lunes, manana, dias]);

  useEffect(() => { cargar(); }, [cargar, version]);

  const porId = useMemo(() => new Map(recetas.map((r) => [r.id, r])), [recetas]);
  const hueco = (f: string, m: "comida" | "cena") => plan.find((h) => h.fecha === f && h.momento === m) ?? null;
  const recetaDe = (h: Hueco | null) => (h?.receta_id ? porId.get(h.receta_id) ?? null : null);

  const cenaHoy = hueco(hoy, "cena");
  const tupper = hueco(manana, "comida");
  const comidaHoy = hueco(hoy, "comida");
  const minutos = (recetaDe(cenaHoy)?.tiempo_min ?? 0) + (recetaDe(tupper)?.tiempo_min ?? 0);
  const nutriHoy = nutrientesDe([comidaHoy, cenaHoy].filter((h): h is Hueco => !!h), recetas);

  const pendientes = lista.filter((i) => !i.comprado).length;
  const caducan = nevera.filter((i) => i.caduca && i.caduca <= sumarDias(hoy, 2)).length;
  const truco = TRUCOS[Number(hoy.slice(8, 10)) % TRUCOS.length];
  const nombre = quien === "rut" ? "Rut" : "Alejandro";

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ margin: "0 0 14px 2px" }}>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 22, color: BCN.tinta, margin: 0 }}>{saludo(nombre)} 👋</p>
        <p style={{ fontSize: 13, color: BCN.humo, margin: "2px 0 0" }}>{fechaLarga(hoy)}</p>
      </motion.div>

      {/* Esta noche */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        style={{
          borderRadius: 22, padding: "16px 16px 14px", marginBottom: 14, color: "white",
          background: `linear-gradient(145deg, ${VERDE} 0%, ${BCN.mar} 115%)`, boxShadow: `0 10px 28px ${VERDE}45`,
        }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0, opacity: 0.85 }}>
            🌙 Esta noche cocináis
          </p>
          {minutos > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.9 }}>≈ {minutos} min</span>}
        </div>

        {cargando ? (
          <div style={{ height: 120 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <PlatoNoche titulo="Cena de hoy" hueco={cenaHoy} receta={recetaDe(cenaHoy)} onAbrir={abrirReceta} onElegir={() => irA("menu")} />
            <PlatoNoche titulo="Tupper de mañana" hueco={tupper} receta={recetaDe(tupper)} onAbrir={abrirReceta} onElegir={() => irA("menu")} />
          </div>
        )}
      </motion.div>

      {/* Cómo vais hoy */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }} style={{ marginBottom: 14 }}>
        <Etiqueta>Hoy, comida y cena</Etiqueta>
        {perfiles.length === 0 ? (
          <motion.button whileTap={{ scale: 0.98 }} onClick={abrirAjustes}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 16, border: `1.5px dashed ${VERDE}66`, background: `${VERDE}0C`,
              cursor: "pointer", textAlign: "left",
            }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: BCN.tinta, margin: 0 }}>Contadme un poco de vosotros 🙂</p>
            <p style={{ fontSize: 13, color: BCN.humo, margin: "3px 0 0" }}>Edad, altura y peso, y os digo lo que necesita cada uno. Un minuto.</p>
          </motion.button>
        ) : nutriHoy.platos === 0 ? (
          <div style={{ background: "white", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, padding: "14px 16px" }}>
            <p style={{ fontSize: 14, color: BCN.tinta, margin: 0 }}>Hoy no hay platos en el menú. Cuando los haya, aquí veréis cómo vais.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: perfiles.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>
            {[...perfiles].sort((a, b) => (a.persona === quien ? -1 : b.persona === quien ? 1 : 0)).map((p) => {
              const meta = parteComidaYCena(necesidades(p));
              return (
                <div key={p.persona} style={{ background: "white", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, padding: "12px 12px 13px" }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: BCN.tinta, margin: "0 0 10px" }}>{p.persona === "rut" ? "Rut" : "Alejandro"}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <Barrita label="Energía" valor={nutriHoy.kcal} objetivo={meta.kcal} unidad="kcal" color={BCN.teja} />
                    <Barrita label="Proteína" valor={nutriHoy.proteinas} objetivo={meta.proteinas} unidad="g" color={BCN.mar} />
                    <Barrita label="Hidratos" valor={nutriHoy.hidratos} objetivo={meta.hidratos} unidad="g" color={BCN.sol} />
                    <Barrita label="Grasas" valor={nutriHoy.grasas} objetivo={meta.grasas} unidad="g" color={BCN.tejaOsc} />
                    <Barrita label="Fibra" valor={nutriHoy.fibra} objetivo={meta.fibra} unidad="g" color={VERDE} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {perfiles.length > 0 && perfiles.length < 2 && (
          <button onClick={abrirAjustes} style={{ marginTop: 6, background: "none", border: "none", color: VERDE, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 4 }}>
            + Añadir los datos de {perfiles[0].persona === "rut" ? "Alejandro" : "Rut"}
          </button>
        )}
      </motion.div>

      {/* Atajos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <Atajo icono="🛒" titulo="Compra" detalle={pendientes ? `${pendientes} ${pendientes === 1 ? "cosa pendiente" : "cosas pendientes"}` : "Lista vacía"} onClick={() => irA("compra")} />
        <Atajo icono="🥬" titulo="¿Qué cocino?" detalle={caducan ? `${caducan} ${caducan === 1 ? "cosa caduca" : "cosas caducan"} pronto` : "Con lo que hay en casa"} onClick={() => irA("nevera")} destacado={caducan > 0} />
        <Atajo icono="🗓️" titulo="Menú" detalle="Planificar la semana" onClick={() => irA("menu")} />
        <Atajo icono="🍱" titulo="Batch cooking" detalle="Cocinar de una sentada" onClick={() => setBatch({ desde: hoy, hasta: dias[6] > hoy ? dias[6] : sumarDias(hoy, 6) })} />
      </div>

      {/* Truco */}
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 16, background: `${BCN.sol}14`, border: `1px solid ${BCN.sol}40`, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <p style={{ fontSize: 13.5, color: BCN.tinta, margin: 0, lineHeight: 1.45 }}>{truco}</p>
      </div>

      <ResumenSemanal lunes={lunes} quien={quien} hayMenu={plan.some((h) => h.receta_id && h.fecha <= dias[6])} />

      <HojaBatch rango={batch} quien={quien} onCerrar={() => setBatch(null)} />
    </div>
  );
}

function PlatoNoche({ titulo, hueco, receta, onAbrir, onElegir }: {
  titulo: string; hueco: Hueco | null; receta: Receta | null; onAbrir: (r: Receta) => void; onElegir: () => void;
}) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={() => (receta ? onAbrir(receta) : onElegir())}
      style={{
        display: "flex", alignItems: "center", gap: 11, padding: 8, borderRadius: 16, border: "none", cursor: "pointer", textAlign: "left",
        background: "rgba(255,255,255,0.16)", backdropFilter: "blur(6px)", color: "white",
      }}>
      {receta ? (
        <div style={{ width: 54 }}><Portada receta={receta} alto={54} radio={12} emoji={26} /></div>
      ) : (
        <div style={{ width: 54, height: 54, borderRadius: 12, border: "1.5px dashed rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {hueco?.texto ? "📝" : "?"}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0, opacity: 0.8 }}>{titulo}</p>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {receta?.nombre ?? hueco?.texto ?? "Sin decidir · elegir"}
        </p>
        {receta && (
          <p style={{ fontSize: 12, margin: "1px 0 0", opacity: 0.85 }}>
            {receta.tiempo_min ? `⏱ ${receta.tiempo_min}′` : ""}{receta.kcal_racion !== null ? ` · ${receta.kcal_racion} kcal` : ""}
            {receta.pasos.length === 0 ? " · ver cómo se hace ›" : " ›"}
          </p>
        )}
      </div>
    </motion.button>
  );
}

function Atajo({ icono, titulo, detalle, onClick, destacado = false }: {
  icono: string; titulo: string; detalle: string; onClick: () => void; destacado?: boolean;
}) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{
        padding: "13px 13px 12px", borderRadius: 16, cursor: "pointer", textAlign: "left",
        border: `1px solid ${destacado ? BCN.sol : BCN.arenaOsc}`, background: destacado ? `${BCN.sol}12` : "white",
        boxShadow: "0 2px 10px rgba(44,36,32,0.04)",
      }}>
      <span style={{ fontSize: 22 }}>{icono}</span>
      <p style={{ fontSize: 14.5, fontWeight: 700, color: BCN.tinta, margin: "6px 0 0" }}>{titulo}</p>
      <p style={{ fontSize: 12, color: BCN.humo, margin: "1px 0 0" }}>{detalle}</p>
    </motion.button>
  );
}
