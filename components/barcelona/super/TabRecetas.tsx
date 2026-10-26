"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BCN } from "@/lib/barcelona/types";
import { VALORACION, avisoAlergia, pedirACocina, type Receta, type RecetaNueva } from "@/lib/barcelona/super";
import { Hoja, Vacio, estiloInput } from "../Shell";
import { Portada, Nutri, BotonIA, Pensando, Aviso, VERDE } from "./Comun";

/* ═══════════════════════════════════════════════════════════
   El recetario: lo que os ha propuesto la IA, lo que habéis
   traído de TikTok o Pinterest y lo vuestro. Con lo que os
   encanta arriba y lo de "nunca más" apartado.
   ═══════════════════════════════════════════════════════════ */

type Filtro = "todas" | "encanta" | "probar" | "nunca";

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "encanta", label: "❤️ Favoritas" },
  { valor: "probar", label: "✨ Por probar" },
  { valor: "nunca", label: "👎 Nunca más" },
];

export function TabRecetas({ recetas, quien, abrirReceta, abrirPrevia }: {
  recetas: Receta[];
  quien: string;
  abrirReceta: (r: Receta) => void;
  abrirPrevia: (r: RecetaNueva) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [nueva, setNueva] = useState(false);

  const visibles = recetas
    .filter((r) =>
      filtro === "todas" ? r.valoracion !== "nunca" :
      filtro === "encanta" ? r.valoracion === "encanta" :
      filtro === "probar" ? r.veces === 0 && r.valoracion === null :
      r.valoracion === "nunca")
    .filter((r) => {
      const q = busqueda.trim().toLowerCase();
      return !q || r.nombre.toLowerCase().includes(q) || r.etiquetas.some((e) => e.includes(q)) ||
        r.ingredientes.some((i) => i.nombre.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const peso = (r: Receta) => (r.valoracion === "encanta" ? 2 : r.valoracion === "bien" ? 1 : 0);
      return peso(b) - peso(a) || b.created_at.localeCompare(a.created_at);
    });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar plato o ingrediente" style={{ ...estiloInput, flex: 1 }} />
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setNueva(true)}
          style={{
            padding: "0 16px", borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
            background: VERDE, color: "white", fontSize: 14, fontWeight: 700,
          }}>
          + Nueva
        </motion.button>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
        {FILTROS.map((f) => {
          const activo = f.valor === filtro;
          return (
            <button key={f.valor} onClick={() => setFiltro(f.valor)}
              style={{
                flexShrink: 0, padding: "7px 13px", borderRadius: 18, cursor: "pointer", fontSize: 13,
                border: `1px solid ${activo ? VERDE : BCN.arenaOsc}`, background: activo ? VERDE : "white",
                color: activo ? "white" : BCN.tinta, fontWeight: activo ? 700 : 500,
              }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        recetas.length === 0 ? (
          <Vacio icon="📖" titulo="Vuestro recetario está vacío"
            texto="Pedid una receta a la IA, pegad un enlace de TikTok o planificad la semana y se irá llenando solo."
            accion={{ label: "Añadir la primera", onClick: () => setNueva(true) }} />
        ) : (
          <p style={{ fontSize: 14, color: BCN.humo, textAlign: "center", padding: "30px 10px" }}>Nada por aquí con ese filtro.</p>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {visibles.map((r, i) => (
            <motion.button key={r.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
              whileTap={{ scale: 0.97 }} onClick={() => abrirReceta(r)}
              style={{
                background: "white", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, padding: 0, overflow: "hidden",
                cursor: "pointer", textAlign: "left", boxShadow: "0 2px 10px rgba(44,36,32,0.04)",
              }}>
              <div style={{ position: "relative" }}>
                <Portada receta={r} alto={104} radio={0} emoji={40} />
                {r.valoracion && (
                  <span style={{ position: "absolute", top: 7, right: 7, fontSize: 14, background: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "2px 6px" }}>
                    {VALORACION[r.valoracion].icon}
                  </span>
                )}
                {avisoAlergia(r) && (
                  <span style={{ position: "absolute", top: 7, left: 7, fontSize: 11, fontWeight: 700, background: BCN.teja, color: "white", borderRadius: 10, padding: "2px 7px" }}>
                    ⚠️ nueces
                  </span>
                )}
              </div>
              <div style={{ padding: "9px 11px 11px" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: BCN.tinta, margin: 0, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {r.nombre}
                </p>
                <p style={{ margin: "4px 0 0", lineHeight: 1.2 }}>
                  {r.tiempo_min && <span style={{ fontSize: 11.5, color: BCN.humo }}>⏱ {r.tiempo_min}′ · </span>}
                  <Nutri r={r} />
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <HojaNueva abierta={nueva} quien={quien} onCerrar={() => setNueva(false)}
        onLista={(r) => { setNueva(false); abrirPrevia(r); }} />
    </div>
  );
}

/* ─── Nueva receta ─────────────────────────────────────────── */

type Modo = "idea" | "enlace";

function HojaNueva({ abierta, quien, onCerrar, onLista }: {
  abierta: boolean;
  quien: string;
  onCerrar: () => void;
  onLista: (r: RecetaNueva) => void;
}) {
  const [modo, setModo] = useState<Modo>("idea");
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (abierta) { setTexto(""); setError(null); setPensando(false); } }, [abierta]);

  const pedir = async () => {
    if (!texto.trim()) return;
    setPensando(true);
    setError(null);
    const res = await pedirACocina(modo === "idea" ? { accion: "receta", texto } : { accion: "importar", texto }, quien);
    setPensando(false);
    if (!res.ok) return setError(res.error);
    const r = res.recetas?.[0];
    if (!r) return setError("No ha salido nada. Prueba otra vez.");
    onLista(r);
  };

  const ideas = ["Unas lentejas como las de casa", "Pollo en salsa para el tupper", "Cena ligera con huevo", "Un guiso de carne con patatas", "Algo con garbanzos"];

  return (
    <Hoja abierta={abierta} onCerrar={() => { if (!pensando) onCerrar(); }} titulo="Nueva receta">
      {pensando ? (
        <Pensando texto={modo === "idea" ? "Cocinando la idea" : "Leyendo la receta"} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {([["idea", "✨ Pedir una idea"], ["enlace", "🔗 Enlace o texto"]] as [Modo, string][]).map(([m, l]) => (
              <button key={m} onClick={() => { setModo(m); setError(null); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: 12, cursor: "pointer", fontSize: 13.5, fontWeight: modo === m ? 700 : 500,
                  border: `1.5px solid ${modo === m ? VERDE : BCN.arenaOsc}`, background: modo === m ? `${VERDE}12` : "white",
                  color: modo === m ? VERDE : BCN.tinta,
                }}>
                {l}
              </button>
            ))}
          </div>

          {modo === "idea" ? (
            <>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} autoFocus
                placeholder="¿Qué os apetece? Ej: unas alubias con chorizo"
                style={{ ...estiloInput, resize: "none", lineHeight: 1.5 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 16px" }}>
                {ideas.map((i) => (
                  <button key={i} onClick={() => setTexto(i)}
                    style={{ padding: "6px 11px", borderRadius: 16, border: `1px solid ${BCN.arenaOsc}`, background: "white", fontSize: 12.5, color: BCN.tinta, cursor: "pointer" }}>
                    {i}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} autoFocus
                placeholder={"Pega el enlace de TikTok, Pinterest o una web…\n\n…o escribe la receta como te salga, que la IA la ordena."}
                style={{ ...estiloInput, resize: "none", lineHeight: 1.5 }} />
              <p style={{ fontSize: 12, color: BCN.humo, margin: "8px 0 16px", lineHeight: 1.45 }}>
                En TikTok: <strong>Compartir → Copiar enlace</strong> y pégalo aquí. Si al vídeo le faltan cantidades, la IA las completa y os lo dice.
              </p>
            </>
          )}

          {error && <div style={{ marginBottom: 10 }}><Aviso>{error}</Aviso></div>}
          <BotonIA onClick={pedir} disabled={!texto.trim()}>{modo === "idea" ? "Crear la receta" : "Leer la receta"}</BotonIA>
        </>
      )}
    </Hoja>
  );
}
