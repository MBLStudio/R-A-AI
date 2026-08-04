"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { loadMomentos, saveMomento, TIPO_CONFIG, type Momento, type TipoMomento } from "@/lib/tarro";
import { uploadPhoto } from "@/lib/upload";
import { PhotoPicker, PhotoDisplay } from "@/components/PhotoPicker";

const other = (u: string) => u === "alejandro" ? "rut" : "alejandro";

// Pseudo-random but deterministic position for each note inside the jar
function noteStyle(index: number, total: number) {
  const seed = (index * 2654435761) >>> 0;
  const x = 8 + (seed % 64);
  const rotate = -20 + ((seed * 3) % 40);
  return { x, rotate };
}

export default function TarroPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const userParam = params.user as UserName;

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMomento, setOpenMomento] = useState<Momento | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTipo, setNewTipo] = useState<TipoMomento>("romantico");
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => {
    loadMomentos().then((m) => { setMomentos(m); setLoading(false); });
  }, []);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setSaving(true);
    let photoUrl: string | null = null;
    if (photoFile) photoUrl = await uploadPhoto(photoFile, "tarro");
    const m = await saveMomento(userParam, text, newTipo, photoUrl);
    if (m) {
      setMomentos((prev) => [m, ...prev]);
      setLastAdded(m.id);
      setTimeout(() => setLastAdded(null), 2000);
      fetch("/api/push/tarro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUser: other(userParam), preview: text }),
      }).catch(() => {});
    }
    setNewText("");
    setNewTipo("romantico");
    setPhotoFile(null);
    setPhotoPreview(null);
    setAdding(false);
    setSaving(false);
  };

  // The jar shows up to 20 notes visually
  const jarMomentos = momentos.slice(0, 20);
  const jarFillRatio = Math.min(1, momentos.length / 30);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        style={{ padding: "14px 20px 12px", paddingTop: `calc(14px + env(safe-area-inset-top))`, background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0, zIndex: 10 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Tarro de momentos 🫙</h1>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
              {momentos.length} momento{momentos.length !== 1 ? "s" : ""} guardado{momentos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setAdding(true)}
            style={{ width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FF2D55, #AF52DE)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(255,45,85,0.3)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </motion.button>
        </div>
      </motion.div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: `calc(90px + env(safe-area-inset-bottom))` }}>

        {/* JAR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px 0" }}>
          <div style={{ position: "relative", width: 200, height: 260 }}>

            {/* Jar body */}
            <div style={{
              position: "absolute", bottom: 0, left: 12, right: 12,
              height: 220, borderRadius: "0 0 40px 40px",
              background: "rgba(135,180,255,0.08)",
              border: "2.5px solid rgba(135,180,255,0.35)",
              overflow: "hidden",
            }}>
              {/* Fill level */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${jarFillRatio * 100}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(180deg, rgba(255,45,85,0.06) 0%, rgba(175,82,222,0.12) 100%)" }}
              />

              {/* Notes inside jar */}
              <AnimatePresence>
                {jarMomentos.map((m, i) => {
                  const { x, rotate } = noteStyle(i, jarMomentos.length);
                  const cfg = TIPO_CONFIG[m.tipo];
                  const isNew = m.id === lastAdded;
                  return (
                    <motion.button
                      key={m.id}
                      initial={isNew ? { y: -80, opacity: 0, rotate: 0 } : false}
                      animate={{ y: 0, opacity: 1, rotate }}
                      transition={isNew ? { type: "spring", stiffness: 200, damping: 18, delay: 0.1 } : { duration: 0 }}
                      whileTap={{ scale: 1.1 }}
                      onClick={() => setOpenMomento(m)}
                      style={{
                        position: "absolute",
                        bottom: `${8 + (i % 6) * 28}px`,
                        left: `${x}%`,
                        width: 44,
                        height: 32,
                        borderRadius: 6,
                        background: cfg.bg,
                        border: `1.5px solid ${cfg.color}40`,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        boxShadow: `0 2px 6px ${cfg.color}25`,
                        transform: `rotate(${rotate}deg)`,
                      }}
                    >
                      {cfg.emoji}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Jar neck */}
            <div style={{ position: "absolute", top: 30, left: 28, right: 28, height: 30, background: "rgba(135,180,255,0.08)", border: "2.5px solid rgba(135,180,255,0.35)", borderBottom: "none" }} />

            {/* Jar lid */}
            <div style={{ position: "absolute", top: 18, left: 20, right: 20, height: 16, borderRadius: 6, background: "rgba(135,180,255,0.15)", border: "2.5px solid rgba(135,180,255,0.4)" }} />

            {/* Jar shine */}
            <div style={{ position: "absolute", bottom: 20, left: 22, width: 8, height: 60, borderRadius: 4, background: "rgba(255,255,255,0.25)", transform: "rotate(-10deg)" }} />
          </div>

          {momentos.length === 0 && !loading && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ fontSize: 13, color: "var(--text-quaternary)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}
            >
              El tarro está vacío 🫙<br />Añade el primer momento
            </motion.p>
          )}

          {/* Legend */}
          {momentos.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
              {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => (
                <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                  <span style={{ fontSize: 12 }}>{cfg.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* List of moments */}
        {momentos.length > 0 && (
          <div style={{ padding: "24px 16px 0" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
              Todos los momentos
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {momentos.map((m, i) => {
                const cfg = TIPO_CONFIG[m.tipo];
                const date = new Date(m.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
                const author = m.user_name === "alejandro" ? "Alejandro" : "Rut";
                return (
                  <motion.button
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setOpenMomento(m)}
                    style={{ background: cfg.bg, border: `1px solid ${cfg.color}25`, borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", textAlign: "left", width: "100%" }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "0 0 4px", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</p>
                      <p style={{ fontSize: 11, color: cfg.color, margin: 0, fontWeight: 600 }}>{author} · {date}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Open momento modal */}
      <AnimatePresence>
        {openMomento && (() => {
          const cfg = TIPO_CONFIG[openMomento.tipo];
          const author = openMomento.user_name === "alejandro" ? "Alejandro" : "Rut";
          const date = new Date(openMomento.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpenMomento(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                onClick={(e) => e.stopPropagation()}
                style={{ background: cfg.bg, border: `2px solid ${cfg.color}40`, borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 360, boxShadow: `0 20px 60px ${cfg.color}30` }}
              >
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <motion.span
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    style={{ fontSize: 40, display: "block" }}
                  >{cfg.emoji}</motion.span>
                </div>
                <p style={{ fontSize: 16, color: "var(--text-primary)", margin: "0 0 12px", lineHeight: 1.6, textAlign: "center" }}>{openMomento.text}</p>
                {openMomento.photo_url && (
                  <img src={openMomento.photo_url} alt="momento" onClick={() => window.open(openMomento.photo_url!, "_blank")}
                    style={{ width: "100%", borderRadius: 14, objectFit: "cover", maxHeight: 220, display: "block", marginBottom: 16, cursor: "pointer" }} />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: 0 }}>{author}</p>
                    <p style={{ fontSize: 11, color: "var(--text-quaternary)", margin: "2px 0 0" }}>{date}</p>
                  </div>
                  <button onClick={() => setOpenMomento(null)}
                    style={{ background: "rgba(0,0,0,0.08)", border: "none", borderRadius: 20, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
                  >Cerrar</button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Add momento sheet */}
      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAdding(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "24px 20px", paddingBottom: `calc(24px + env(safe-area-inset-bottom))`, width: "100%" }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)", margin: "0 auto 20px" }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "var(--text-primary)" }}>Añadir al tarro 🫙</h2>

              {/* Tipo selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {(Object.entries(TIPO_CONFIG) as [TipoMomento, typeof TIPO_CONFIG[TipoMomento]][]).map(([tipo, cfg]) => (
                  <button key={tipo} onClick={() => setNewTipo(tipo)}
                    style={{ padding: "10px 12px", borderRadius: 12, border: `2px solid ${newTipo === tipo ? cfg.color : "transparent"}`, background: newTipo === tipo ? cfg.bg : "rgba(0,0,0,0.04)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}
                  >
                    <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: newTipo === tipo ? cfg.color : "var(--text-secondary)" }}>{cfg.label}</span>
                  </button>
                ))}
              </div>

              <textarea
                autoFocus value={newText} onChange={(e) => setNewText(e.target.value)}
                placeholder="Escribe el momento que quieres guardar…"
                rows={4}
                style={{ width: "100%", background: "#FAFAFA", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "var(--text-primary)", resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.5 }}
              />

              <PhotoPicker
                preview={photoPreview}
                onSelect={(f, p) => { setPhotoFile(f); setPhotoPreview(p); }}
                onRemove={() => { setPhotoFile(null); setPhotoPreview(null); }}
                accentColor={TIPO_CONFIG[newTipo].color}
              />
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} disabled={!newText.trim() || saving}
                style={{ width: "100%", marginTop: 12, padding: "14px", background: newText.trim() ? `linear-gradient(135deg, ${TIPO_CONFIG[newTipo].color}, #AF52DE)` : "rgba(0,0,0,0.07)", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, color: newText.trim() ? "white" : "var(--text-quaternary)", cursor: newText.trim() ? "pointer" : "default", transition: "all 0.2s" }}
              >
                {saving ? "Subiendo…" : `Echar al tarro ${TIPO_CONFIG[newTipo].emoji}`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav userParam={userParam} router={router} />
    </div>
  );
}

function BottomNav({ userParam, router }: { userParam: string; router: any }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-around", alignItems: "center", paddingBottom: "env(safe-area-inset-bottom)", paddingTop: 8, zIndex: 100 }}>
      {[{ icon: "⊞", label: "Inicio", href: `/${userParam}` }, { icon: "👤", label: "Perfil", href: `/${userParam}/profile` }].map((item) => (
        <button key={item.href} onClick={() => router.push(item.href)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 20px", background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
