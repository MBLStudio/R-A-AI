"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, type Etapa, type Momento } from "@/lib/barcelona/types";
import { getEtapaActiva, getHistoria, diasEnCiudad, formatFechaLarga } from "@/lib/barcelona/queries";

/* ═══════════════════════════════════════════════════════════
   Nuestra Barcelona — el libro.

   Portada, el relato repartido en páginas, un álbum de fotos
   y la contraportada. Se pasa como un libro: arrastrando o
   con las flechas.
   ═══════════════════════════════════════════════════════════ */

type Pagina =
  | { tipo: "portada" }
  | { tipo: "texto"; parrafos: string[]; n: number }
  | { tipo: "album"; fotos: string[] }
  | { tipo: "final" };

export default function LibroPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [texto, setTexto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [regenerando, setRegenerando] = useState(false);

  const [pagina, setPagina] = useState(0);
  const [sentido, setSentido] = useState(1);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  const generar = useCallback(async (e: Etapa, force: boolean) => {
    try {
      const res = await fetch("/api/barcelona/resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapaId: e.id, tipo: "narrativa", force }),
      });
      const data = await res.json();
      setTexto(data.contenido ?? null);
    } catch { setTexto(null); }
  }, []);

  useEffect(() => {
    (async () => {
      const e = await getEtapaActiva();
      if (!e) { setCargando(false); return; }
      setEtapa(e);
      const h = await getHistoria(e.id);
      setMomentos(h);
      if (h.length > 0) await generar(e, false);
      setCargando(false);
    })();
  }, [generar]);

  const fotos = useMemo(() => momentos.flatMap((m) => m.fotos), [momentos]);

  /** El relato se reparte en páginas de 3 párrafos. */
  const paginas = useMemo<Pagina[]>(() => {
    const p: Pagina[] = [{ tipo: "portada" }];

    if (texto) {
      const parrafos = texto.split("\n").map((x) => x.trim()).filter(Boolean);
      for (let i = 0; i < parrafos.length; i += 3) {
        p.push({ tipo: "texto", parrafos: parrafos.slice(i, i + 3), n: p.length });
      }
    }

    if (fotos.length > 0) p.push({ tipo: "album", fotos: fotos.slice(0, 9) });
    p.push({ tipo: "final" });
    return p;
  }, [texto, fotos]);

  const total = paginas.length;
  const pasar = (n: number) => {
    const destino = pagina + n;
    if (destino < 0 || destino >= total) return;
    setSentido(n);
    setPagina(destino);
  };

  const dias = etapa ? diasEnCiudad(etapa.fecha_llegada) : null;
  const hitos = momentos.filter((m) => m.es_hito);

  return (
    <div style={{
      height: "100dvh", overflow: "hidden", position: "relative",
      background: `linear-gradient(165deg, ${BCN.noche} 0%, #14212B 55%, ${BCN.tejaOsc} 140%)`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Cabecera */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
        paddingTop: `calc(12px + env(safe-area-inset-top))`, flexShrink: 0, zIndex: 5,
      }}>
        <button onClick={() => history.back()} aria-label="Cerrar el libro"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {total > 1 && (
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
            {pagina + 1} / {total}
          </span>
        )}

        {texto && (
          <button
            onClick={async () => { if (!etapa) return; setRegenerando(true); await generar(etapa, true); setPagina(0); setRegenerando(false); }}
            disabled={regenerando}
            style={{ marginLeft: "auto", padding: "7px 13px", borderRadius: 18, background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 12, cursor: "pointer" }}>
            {regenerando ? "Reescribiendo…" : "Reescribir"}
          </button>
        )}
      </div>

      {/* La página */}
      <div style={{ flex: 1, position: "relative", padding: "6px 18px 0", minHeight: 0 }}>
        {cargando ? (
          <Hoja><Cargando /></Hoja>
        ) : momentos.length === 0 ? (
          <Hoja>
            <Centro
              titulo="El libro está en blanco"
              texto="Guardad vuestros primeros momentos y aquí se irá escribiendo solo, con lo que vayáis viviendo."
            />
          </Hoja>
        ) : (
          <AnimatePresence mode="wait" custom={sentido}>
            <motion.div
              key={pagina}
              custom={sentido}
              initial={{ opacity: 0, rotateY: sentido > 0 ? -14 : 14, x: sentido > 0 ? 40 : -40 }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              exit={{ opacity: 0, rotateY: sentido > 0 ? 14 : -14, x: sentido > 0 ? -40 : 40 }}
              transition={{ duration: 0.34, ease: [0.25, 0.46, 0.45, 0.94] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.14}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) pasar(1);
                else if (info.offset.x > 70) pasar(-1);
              }}
              style={{ height: "100%", perspective: 1200 }}
            >
              <Hoja>
                {(() => {
                  const p = paginas[pagina];
                  if (!p) return null;

                  if (p.tipo === "portada") {
                    return (
                      <Portada
                        etapa={etapa}
                        dias={dias}
                        momentos={momentos.length}
                        hitos={hitos.length}
                      />
                    );
                  }

                  if (p.tipo === "texto") {
                    return (
                      <div style={{ paddingTop: 6 }}>
                        {p.parrafos.map((parrafo, i) => (
                          <p key={i} style={{
                            fontFamily: "Georgia, 'Times New Roman', serif",
                            fontSize: 16.5, lineHeight: 1.82, color: BCN.tinta,
                            margin: i === 0 ? 0 : "17px 0 0",
                            textAlign: "justify", hyphens: "auto",
                          }}>
                            {p.n === 1 && i === 0 ? (
                              <>
                                <span style={{ fontSize: 40, float: "left", lineHeight: 0.82, marginRight: 9, marginTop: 4, color: BCN.teja, fontFamily: "Georgia, serif" }}>
                                  {parrafo[0]}
                                </span>
                                {parrafo.slice(1)}
                              </>
                            ) : parrafo}
                          </p>
                        ))}
                      </div>
                    );
                  }

                  if (p.tipo === "album") {
                    return (
                      <div>
                        <p style={{ fontFamily: "Georgia, serif", fontSize: 19, color: BCN.tinta, margin: "0 0 16px", textAlign: "center" }}>
                          El álbum
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                          {p.fotos.map((url, i) => (
                            <div key={url} style={{
                              aspectRatio: "1", borderRadius: 7, overflow: "hidden",
                              border: `1px solid ${BCN.arenaOsc}`,
                              transform: `rotate(${(i % 3 - 1) * 1.4}deg)`,
                              boxShadow: "0 2px 8px rgba(44,36,32,0.12)",
                            }}>
                              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Centro
                      titulo="Continuará"
                      texto="Este libro crece con vosotros. Cada momento que guardéis se escribe aquí."
                    />
                  );
                })()}
              </Hoja>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Pasar página */}
      {!cargando && momentos.length > 0 && total > 1 && (
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
          padding: "14px 0", paddingBottom: `calc(14px + env(safe-area-inset-bottom))`,
        }}>
          <button onClick={() => pasar(-1)} disabled={pagina === 0} aria-label="Página anterior"
            style={{ ...flechaLibro, opacity: pagina === 0 ? 0.22 : 1 }}>‹</button>

          <div style={{ display: "flex", gap: 5 }}>
            {paginas.map((_, i) => (
              <span key={i} style={{
                width: i === pagina ? 16 : 5, height: 5, borderRadius: 3,
                background: i === pagina ? BCN.sol : "rgba(255,255,255,0.25)",
                transition: "all 0.25s",
              }} />
            ))}
          </div>

          <button onClick={() => pasar(1)} disabled={pagina === total - 1} aria-label="Página siguiente"
            style={{ ...flechaLibro, opacity: pagina === total - 1 ? 0.22 : 1 }}>›</button>
        </div>
      )}
    </div>
  );
}

/* ─── La hoja de papel ─────────────────────────────────────── */

function Hoja({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: "100%", background: "#FBF6ED", borderRadius: "6px 14px 14px 6px",
      borderLeft: `5px solid ${BCN.tejaOsc}`,
      padding: "28px 24px", overflowY: "auto", WebkitOverflowScrolling: "touch",
      boxShadow: "0 14px 44px rgba(0,0,0,0.4), inset 3px 0 8px -4px rgba(90,36,24,0.16)",
      boxSizing: "border-box",
    }}>
      {children}
    </div>
  );
}

/* ─── Portada ──────────────────────────────────────────────── */

function Portada({ etapa, dias, momentos, hitos }: {
  etapa: Etapa | null; dias: number | null; momentos: number; hitos: number;
}) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", padding: "10px 0" }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: BCN.teja, textTransform: "uppercase", letterSpacing: "0.22em", margin: "0 0 18px" }}>
        {etapa?.nombre ?? "Barcelona"}
      </p>

      <h1 style={{
        fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 40, fontWeight: 400,
        color: BCN.tinta, margin: 0, lineHeight: 1.08, letterSpacing: "-1px",
      }}>
        Nuestra<br />Barcelona
      </h1>

      <div style={{ width: 56, height: 2, background: BCN.teja, margin: "24px auto", opacity: 0.5 }} />

      <p style={{ fontFamily: "Georgia, serif", fontSize: 14, color: BCN.humo, margin: 0, fontStyle: "italic", lineHeight: 1.7 }}>
        {dias !== null && dias > 0 && <>{dias} días<br /></>}
        {momentos} {momentos === 1 ? "momento" : "momentos"}
        {hitos > 0 && <> · {hitos} {hitos === 1 ? "hito" : "hitos"}</>}
      </p>

      <p style={{ fontSize: 12, color: BCN.humo, margin: "34px 0 0", opacity: 0.65 }}>
        Deslizad para pasar página
      </p>
    </div>
  );
}

function Centro({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 22, color: BCN.tinta, margin: "0 0 10px" }}>{titulo}</p>
      <p style={{ fontSize: 14, color: BCN.humo, margin: 0, lineHeight: 1.7, maxWidth: 260, marginInline: "auto" }}>{texto}</p>
    </div>
  );
}

function Cargando() {
  return (
    <div style={{ paddingTop: 20 }}>
      {[100, 94, 88, 97, 72, 90, 82].map((w, i) => (
        <motion.div key={i}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12 }}
          style={{ height: 12, width: `${w}%`, borderRadius: 6, background: BCN.arenaOsc, marginBottom: 15 }} />
      ))}
      <p style={{ fontSize: 12.5, color: BCN.humo, margin: "14px 0 0", textAlign: "center", fontStyle: "italic" }}>
        Escribiendo vuestra historia…
      </p>
    </div>
  );
}

const flechaLibro: React.CSSProperties = {
  width: 40, height: 40, borderRadius: "50%", border: "none",
  background: "rgba(255,255,255,0.12)", color: "white",
  fontSize: 22, cursor: "pointer", lineHeight: 1,
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "opacity 0.2s",
};
