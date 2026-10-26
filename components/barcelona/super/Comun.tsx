"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { VALORACION, type Receta, type RecetaNueva, type Valoracion, type Nutrientes } from "@/lib/barcelona/super";

/* ═══════════════════════════════════════════════════════════
   Piezas pequeñas del Supermercado: la portada de cada plato,
   los números de nutrición, la valoración y el "pensando…".
   ═══════════════════════════════════════════════════════════ */

/** El color de la casa en esta sección: verde de mercado. */
export const VERDE = BCN.oliva;

/* ─── Portada de un plato ──────────────────────────────────── */

const EMOJIS: [RegExp, string][] = [
  [/pizza/i, "🍕"], [/hamburgues|smash|burger/i, "🍔"], [/taco|fajita|quesadilla/i, "🌮"],
  [/burrito|wrap|rollito/i, "🌯"], [/sushi|poke/i, "🍣"], [/ramen|fideo|noodle|udon|pho/i, "🍜"],
  [/curry|dal|tikka|masala/i, "🍛"], [/pasta|espagueti|macarr|tallar|lasa|gnocchi|ñoqui|risotto/i, "🍝"],
  [/arroz|paella|bowl|poke/i, "🍚"], [/ensalada|bowl verde/i, "🥗"], [/sopa|crema|caldo|puré|gazpacho/i, "🥣"],
  [/lenteja|garbanzo|alubia|guiso|estofado|potaje|chili/i, "🍲"], [/pollo|pavo|alita/i, "🍗"],
  [/salm[oó]n|merluza|bacalao|at[uú]n|pescado|lubina|dorada/i, "🐟"], [/gamba|langostino|marisco/i, "🍤"],
  [/huevo|tortilla|shakshuka|frittata/i, "🍳"], [/ternera|cerdo|lomo|carne|filete/i, "🥩"],
  [/tosta|tostada|bocadillo|s[aá]ndwich|pan/i, "🥪"], [/hummus|falafel|pita/i, "🧆"],
  [/tortita|crep|pancake/i, "🥞"], [/patata|boniato/i, "🍠"], [/verdura|br[oó]coli|calabac|berenjena/i, "🥦"],
];

export function emojiDe(nombre: string): string {
  for (const [p, e] of EMOJIS) if (p.test(nombre)) return e;
  return "🍽️";
}

const TONOS = [BCN.oliva, BCN.teja, BCN.sol, BCN.mar, BCN.marClaro, BCN.tejaOsc];

function tonoDe(nombre: string): string {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS[h % TONOS.length];
}

/** La foto del plato si la tiene; si no, un degradado con su emoji. */
export function Portada({ receta, alto = 120, radio = 14, emoji = 44 }: {
  receta: Pick<Receta, "nombre"> & { foto_url?: string | null };
  alto?: number | string;
  radio?: number;
  emoji?: number;
}) {
  if (receta.foto_url) {
    return (
      <div style={{ height: alto, borderRadius: radio, overflow: "hidden", background: BCN.arenaOsc, flexShrink: 0 }}>
        <img src={receta.foto_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  const tono = tonoDe(receta.nombre);
  return (
    <div style={{
      height: alto, borderRadius: radio, flexShrink: 0, position: "relative", overflow: "hidden",
      background: `radial-gradient(circle at 30% 20%, ${tono}55 0%, ${tono}22 55%, ${tono}10 100%), ${BCN.arena}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: emoji, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.12))" }}>{emojiDe(receta.nombre)}</span>
    </div>
  );
}

/* ─── Nutrición ────────────────────────────────────────────── */

type ConNutri = Pick<RecetaNueva, "kcal_racion" | "proteinas_racion" | "hidratos_racion" | "grasas_racion" | "fibra_racion">;

/** Los números de un plato, por ración. Compactos para tarjetas, amplios para la ficha. */
export function Nutri({ r, amplio = false }: { r: ConNutri; amplio?: boolean }) {
  if (r.kcal_racion === null) return null;
  const datos = [
    { v: r.kcal_racion, u: "kcal", l: "Energía", c: BCN.teja },
    { v: r.proteinas_racion, u: "g", l: "Proteína", c: BCN.mar },
    { v: r.hidratos_racion, u: "g", l: "Hidratos", c: BCN.sol },
    { v: r.grasas_racion, u: "g", l: "Grasas", c: BCN.tejaOsc },
    { v: r.fibra_racion, u: "g", l: "Fibra", c: BCN.oliva },
  ].filter((d) => d.v !== null);

  if (!amplio) {
    return (
      <span style={{ fontSize: 11.5, color: BCN.humo, fontVariantNumeric: "tabular-nums" }}>
        {r.kcal_racion} kcal{r.proteinas_racion !== null ? ` · ${r.proteinas_racion} g prot` : ""}
      </span>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${datos.length}, 1fr)`, gap: 6 }}>
      {datos.map((d) => (
        <div key={d.l} style={{ background: "white", border: `1px solid ${BCN.arenaOsc}`, borderRadius: 12, padding: "8px 4px", textAlign: "center" }}>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 17, color: d.c, margin: 0, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
            {d.v}<span style={{ fontSize: 10.5, marginLeft: 1 }}>{d.u === "kcal" ? "" : d.u}</span>
          </p>
          <p style={{ fontSize: 9.5, color: BCN.humo, margin: "3px 0 0" }}>{d.u === "kcal" ? "kcal" : d.l}</p>
        </div>
      ))}
    </div>
  );
}

/** Una barrita de "llevas X de Y", sin agobiar: pasarse un poco no es rojo. */
export function Barrita({ label, valor, objetivo, unidad, color }: {
  label: string; valor: number; objetivo: number; unidad: string; color: string;
}) {
  const pct = objetivo > 0 ? Math.min(1.15, valor / objetivo) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, color: BCN.tinta, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: BCN.humo, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(valor)} / {objetivo} {unidad}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: BCN.arena, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct * 100)}%` }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ height: "100%", borderRadius: 4, background: color }}
        />
      </div>
    </div>
  );
}

export function sumaNutri(a: Nutrientes, b: Nutrientes): Nutrientes {
  return {
    kcal: a.kcal + b.kcal, proteinas: a.proteinas + b.proteinas, hidratos: a.hidratos + b.hidratos,
    grasas: a.grasas + b.grasas, fibra: a.fibra + b.fibra,
  };
}

/* ─── Valoración ───────────────────────────────────────────── */

export function BotonesValoracion({ valor, onChange }: { valor: Valoracion | null; onChange: (v: Valoracion | null) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {(Object.keys(VALORACION) as Valoracion[]).map((v) => {
        const activo = valor === v;
        const cfg = VALORACION[v];
        return (
          <motion.button key={v} whileTap={{ scale: 0.92 }} onClick={() => onChange(activo ? null : v)}
            style={{
              flex: 1, padding: "9px 4px", borderRadius: 12, cursor: "pointer",
              border: `1.5px solid ${activo ? cfg.color : BCN.arenaOsc}`,
              background: activo ? `${cfg.color}14` : "white",
              color: activo ? cfg.color : BCN.tinta, fontSize: 12.5, fontWeight: activo ? 700 : 500,
            }}>
            <span style={{ fontSize: 16, display: "block", marginBottom: 1 }}>{cfg.icon}</span>
            {cfg.label}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── Mientras piensa la IA ────────────────────────────────── */

const FRASES = [
  "Abriendo la nevera…", "Mirando qué hay de temporada…", "Pensando algo que no sea lo de siempre…",
  "Calculando proteínas…", "Probando la salsa…", "Buscando inspiración en TikTok…",
  "Apuntando cantidades…", "Poniéndole un toque…",
];

export function Pensando({ texto }: { texto?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % FRASES.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "28px 12px" }}>
      <motion.div
        animate={{ rotate: [0, -12, 12, -6, 0], y: [0, -4, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ fontSize: 40, display: "inline-block" }}
      >
        🍳
      </motion.div>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 16, color: BCN.tinta, margin: "10px 0 4px" }}>
        {texto ?? "Un momento"}
      </p>
      <motion.p key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: 13, color: BCN.humo, margin: 0 }}>
        {FRASES[i]}
      </motion.p>
    </div>
  );
}

/* ─── Botones ──────────────────────────────────────────────── */

/** El botón de la IA: siempre con su chispa, para que se reconozca. */
export function BotonIA({ children, onClick, disabled, pequeno = false }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; pequeno?: boolean;
}) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled}
      style={{
        width: pequeno ? "auto" : "100%", padding: pequeno ? "9px 14px" : "13px 14px",
        borderRadius: pequeno ? 20 : 14, border: "none", cursor: disabled ? "default" : "pointer",
        background: disabled ? BCN.arenaOsc : `linear-gradient(135deg, ${VERDE} 0%, ${BCN.mar} 100%)`,
        color: disabled ? BCN.humo : "white", fontSize: pequeno ? 13 : 14.5, fontWeight: 700,
        boxShadow: disabled ? "none" : `0 4px 14px ${VERDE}40`,
      }}>
      ✨ {children}
    </motion.button>
  );
}

export function BotonSecundario({ children, onClick, color = BCN.tinta }: {
  children: React.ReactNode; onClick: () => void; color?: string;
}) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick}
      style={{
        padding: "10px 14px", borderRadius: 12, cursor: "pointer",
        border: `1px solid ${BCN.arenaOsc}`, background: "white", color, fontSize: 13.5, fontWeight: 600,
      }}>
      {children}
    </motion.button>
  );
}

export function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 9px 3px" }}>
      {children}
    </p>
  );
}

export function Aviso({ children, color = BCN.teja }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 12, background: `${color}12`, border: `1px solid ${color}40`, fontSize: 13, color: BCN.tinta, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}
