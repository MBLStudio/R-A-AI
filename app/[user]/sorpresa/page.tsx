"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SignaturePad } from "@/components/SignaturePad";
import { uploadPhoto } from "@/lib/upload";
import {
  loadSorpresa,
  saveSorpresa,
  marcarSorpresaAbierta,
  fmtFechaLarga,
  SORPRESA_VACIA,
  CARTA_RUT,
  type Sorpresa,
} from "@/lib/sorpresa";

const SCRIPT = "var(--font-script), 'Segoe Script', 'Bradley Hand', cursive";
const SCRIPT_ELEGANT = "var(--font-script-elegant), 'Segoe Script', cursive";
const ROSE = "#C1135A";
const WINE = "#7A1231";
const GOLD = "#C9A96E";
const PAPER_BG = "#f4ecdd";
const MAX_FOTOS = 3;

/* ══════════════════════════════════════════════════════════════════════════
   PÁGINA
   ══════════════════════════════════════════════════════════════════════════ */
export default function SorpresaPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const userParam = params.user as UserName;
  const isAlejandro = userParam === "alejandro";

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  const [s, setS] = useState<Sorpresa | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Campos del editor (Alejandro) ───────────────────────────────────────
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [firmaNombre, setFirmaNombre] = useState("");
  const [fotoCaption, setFotoCaption] = useState("");

  const [saving, setSaving] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [showPad, setShowPad] = useState(false);
  const [savingFirma, setSavingFirma] = useState(false);

  useEffect(() => {
    loadSorpresa().then((data) => {
      const d = data ?? SORPRESA_VACIA;
      setS(d);
      // Precarga la carta si aún no hay nada escrito
      setTitulo(d.titulo || CARTA_RUT.titulo);
      setCuerpo(d.cuerpo || CARTA_RUT.cuerpo);
      setFirmaNombre(d.firma_nombre || CARTA_RUT.firma_nombre);
      setFotoCaption(d.foto_caption);
      setLoading(false);
    });
  }, []);

  const dirty = !!s && (
    titulo !== s.titulo ||
    cuerpo !== s.cuerpo ||
    firmaNombre !== s.firma_nombre ||
    fotoCaption !== s.foto_caption
  );

  const guardarTexto = async (): Promise<Sorpresa | null> => {
    setSaving(true);
    const updated = await saveSorpresa({
      titulo: titulo.trim(),
      cuerpo,
      firma_nombre: firmaNombre.trim(),
      foto_caption: fotoCaption.trim(),
    });
    if (updated) setS(updated);
    else alert("No se pudo guardar. ¿Has creado la tabla «sorpresa» en Supabase?");
    setSaving(false);
    return updated;
  };

  const addFoto = async (file: File) => {
    if ((s?.fotos?.length ?? 0) >= MAX_FOTOS) return;
    setUploadingFoto(true);
    const url = await uploadPhoto(file, "sorpresa");
    if (url) {
      const updated = await saveSorpresa({ fotos: [...(s?.fotos ?? []), url] });
      if (updated) setS(updated);
    } else {
      alert("No se pudo subir la foto. Inténtalo de nuevo.");
    }
    setUploadingFoto(false);
  };

  const quitarFoto = async (url: string) => {
    const updated = await saveSorpresa({ fotos: (s?.fotos ?? []).filter((u) => u !== url) });
    if (updated) setS(updated);
  };

  const handleFirma = async (blob: Blob) => {
    setSavingFirma(true);
    try {
      const file = new File([blob], "firma-sorpresa.png", { type: "image/png" });
      const url = await uploadPhoto(file, "sorpresa/firma");
      if (!url) throw new Error();
      const updated = await saveSorpresa({ firma_url: url, firma_at: new Date().toISOString() });
      if (updated) setS(updated);
      setShowPad(false);
    } catch {
      alert("No se pudo guardar la firma. Inténtalo de nuevo.");
    }
    setSavingFirma(false);
  };

  const revelar = async () => {
    if (!cuerpo.trim()) { alert("Escribe primero la carta 💌"); return; }
    if (!window.confirm("¿Revelar la sorpresa a Rut?\nLe llegará una notificación ahora mismo.")) return;
    setRevealing(true);
    await guardarTexto();
    const updated = await saveSorpresa({ revelada: true, revelada_at: new Date().toISOString() });
    if (updated) setS(updated);
    fetch("/api/push/sorpresa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "revelada" }),
    }).catch(() => {});
    setRevealing(false);
  };

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading || !s) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: PAPER_BG }}>
        <p style={{ color: WINE, fontFamily: SCRIPT_ELEGANT, fontSize: 22 }}>Un momento…</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VISTA DE RUT
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isAlejandro) {
    if (!s.revelada) {
      return (
        <Shell router={router}>
          <div style={{ textAlign: "center", paddingTop: 90 }}>
            <p style={{ fontSize: 52, margin: "0 0 14px" }}>🤫</p>
            <p style={{ fontSize: 17, fontWeight: 600, color: WINE, margin: "0 0 6px" }}>Aquí todavía no hay nada</p>
            <p style={{ fontSize: 13, color: "#9a7b62", margin: 0, lineHeight: 1.6 }}>
              Cuando esté lista, lo sabrás 💗
            </p>
          </div>
        </Shell>
      );
    }
    return <RutView s={s} onOpened={setS} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VISTA DE ALEJANDRO (editor)
  // ═══════════════════════════════════════════════════════════════════════════
  const preview: Sorpresa = { ...s, titulo, cuerpo, firma_nombre: firmaNombre, foto_caption: fotoCaption };
  const fotos = s.fotos ?? [];

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: PAPER_BG, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px 12px", paddingTop: "calc(14px + env(safe-area-inset-top))", background: "rgba(244,236,221,0.95)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${GOLD}55`, flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: `${GOLD}30`, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: WINE, margin: 0 }}>Sorpresa 🎁</h1>
            <p style={{ fontSize: 11, color: "#9a7b62", margin: 0 }}>
              {s.revelada ? "Revelada · Rut ya puede verla" : "Para Rut · en secreto"}
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px", paddingBottom: "calc(120px + env(safe-area-inset-bottom))" }}>

        {/* Estado */}
        {s.revelada ? (
          <div style={{ background: "rgba(52,199,89,0.1)", border: "1px solid rgba(52,199,89,0.28)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#2b8a3e", margin: "0 0 2px" }}>✓ Revelada el {fmtFechaLarga(s.revelada_at)}</p>
            <p style={{ fontSize: 12, color: "#3a7d4a", margin: 0 }}>
              {s.abierta_at ? `Rut la abrió el ${fmtFechaLarga(s.abierta_at)} 💗` : "Rut aún no la ha abierto."}
              {" "}Tus cambios se guardan y verá siempre la última versión.
            </p>
          </div>
        ) : (
          <div style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}66`, borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontSize: 12.5, color: "#7a5c3e", margin: 0, lineHeight: 1.55 }}>
              La carta ya está escrita abajo — <b>revísala y pulsa Guardar</b>. Añade la foto del tatuaje y tu firma.
              Cuando esté lista, pulsa <b>Revelar a Rut</b>.
            </p>
          </div>
        )}

        {/* Vista previa */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9a7b62", textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 10px" }}>
          Vista previa · gira la carta para ver el reverso
        </p>
        <LetterCard s={preview} height="72dvh" />

        {/* ─── Editor ─────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 18 }}>

          <Field label="Encabezado">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Para Rut" style={inputStyle} />
          </Field>

          <Field label="La carta">
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder="Escribe aquí lo que quieres decirle…"
              rows={14}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7, minHeight: 220 }}
            />
            <p style={{ fontSize: 11, color: "#9a7b62", margin: "6px 2px 0" }}>
              Se mostrará con caligrafía. Un renglón en blanco separa párrafos.
            </p>
          </Field>

          <Field label="Despedida / firma escrita">
            <input value={firmaNombre} onChange={(e) => setFirmaNombre(e.target.value)} placeholder="Tuyo, Alejandro" style={inputStyle} />
          </Field>

          <Field label="Tu firma (a mano)">
            <div
              onClick={() => setShowPad(true)}
              style={{ height: 96, borderRadius: 12, border: `2px dashed ${GOLD}80`, background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {s.firma_url ? (
                <img src={s.firma_url} alt="Tu firma" style={{ maxHeight: 78, maxWidth: "80%", objectFit: "contain" }} />
              ) : (
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 20, margin: "0 0 2px" }}>✍️</p>
                  <p style={{ fontSize: 12, color: "#9a7b62", fontWeight: 600, margin: 0 }}>Pulsa para firmar</p>
                </div>
              )}
            </div>
            {s.firma_url && (
              <button onClick={() => setShowPad(true)} style={{ marginTop: 8, fontSize: 12, color: WINE, background: `${GOLD}22`, border: `1px solid ${GOLD}66`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>
                Repetir firma
              </button>
            )}
          </Field>

          <Field label={`Las fotos del tatuaje · el reverso (${fotos.length}/${MAX_FOTOS})`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {fotos.map((url) => (
                <div key={url} style={{ position: "relative", width: 88, height: 88 }}>
                  <img src={url} alt="Foto" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: `1px solid ${GOLD}66` }} />
                  <button
                    onClick={() => quitarFoto(url)}
                    style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="3" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
              {uploadingFoto ? (
                <span style={{ fontSize: 13, color: "#9a7b62" }}>Subiendo…</span>
              ) : fotos.length < MAX_FOTOS ? (
                <PhotoPicker preview={null} onSelect={(file) => addFoto(file)} onRemove={() => {}} accentColor={ROSE} />
              ) : null}
            </div>
          </Field>

          <Field label="Pie de foto (opcional)">
            <input value={fotoCaption} onChange={(e) => setFotoCaption(e.target.value)} placeholder="Ahora te llevo siempre conmigo" style={inputStyle} />
          </Field>
        </div>
      </div>

      {/* Barra inferior fija */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", background: "rgba(244,236,221,0.96)", backdropFilter: "blur(12px)", borderTop: `1px solid ${GOLD}55`, display: "flex", gap: 10, zIndex: 20 }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={guardarTexto}
          disabled={saving || !dirty}
          style={{
            flex: 1, padding: "14px", borderRadius: 14, border: "none",
            fontSize: 14, fontWeight: 700, cursor: dirty && !saving ? "pointer" : "default",
            background: dirty && !saving ? "white" : "rgba(0,0,0,0.06)",
            color: dirty && !saving ? WINE : "#b7a68f",
            boxShadow: dirty && !saving ? "0 2px 10px rgba(0,0,0,0.08)" : "none",
          }}
        >
          {saving ? "Guardando…" : dirty ? "Guardar" : "Guardado ✓"}
        </motion.button>

        {!s.revelada && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={revelar}
            disabled={revealing}
            style={{
              flex: 1.4, padding: "14px", borderRadius: 14, border: "none",
              fontSize: 14, fontWeight: 800, cursor: revealing ? "default" : "pointer",
              background: `linear-gradient(135deg, ${ROSE}, #FF6B35)`,
              color: "white", boxShadow: `0 4px 16px ${ROSE}55`,
            }}
          >
            {revealing ? "Revelando…" : "🎁 Revelar a Rut"}
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showPad && (
          <SignaturePad
            onSave={handleFirma}
            onCancel={() => setShowPad(false)}
            saving={savingFirma}
            theme={{
              sheetBg: "#fdf4ec",
              accent: ROSE,
              titleColor: WINE,
              strokeColor: "#2a0a16",
              confirmGradient: `linear-gradient(135deg, ${ROSE}, #FF6B35)`,
              fontFamily: SCRIPT_ELEGANT,
              title: "✍️ Tu firma para Rut",
              hint: "Firma aquí con el dedo",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VISTA DE RUT — regalo → apertura → carta
   ══════════════════════════════════════════════════════════════════════════ */
function RutView({ s, onOpened }: { s: Sorpresa; onOpened: (s: Sorpresa) => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"gift" | "opening" | "letter">(s.abierta_at ? "letter" : "gift");

  const abrir = () => {
    if (phase !== "gift") return;
    setPhase("opening");
    marcarSorpresaAbierta().catch(() => {});
    fetch("/api/push/sorpresa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "abierta" }),
    }).catch(() => {});
    onOpened({ ...s, abierta_at: new Date().toISOString() });
    setTimeout(() => setPhase("letter"), 1700);
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: PAPER_BG, overflow: "hidden", position: "relative" }}>
      {/* Header mínimo */}
      <div style={{ padding: "14px 20px", paddingTop: "calc(14px + env(safe-area-inset-top))", flexShrink: 0, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: `${GOLD}30`, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── Regalo cerrado ─────────────────────────────────────────────── */}
        {phase === "gift" && (
          <motion.button
            key="gift"
            onClick={abrir}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "none", border: "none", cursor: "pointer", padding: "0 24px 80px" }}
          >
            <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${ROSE}22 0%, transparent 70%)` }} />
            <motion.span
              animate={{ y: [0, -12, 0], rotate: [-3, 3, -3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: 128, filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.18))", zIndex: 1 }}
            >
              🎁
            </motion.span>
            <div style={{ textAlign: "center", zIndex: 1 }}>
              <p style={{ fontFamily: SCRIPT_ELEGANT, fontSize: 28, color: WINE, margin: "0 0 10px", lineHeight: 1.2 }}>
                Alejandro tiene algo para ti
              </p>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: 13, fontWeight: 700, color: ROSE, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}
              >
                Toca para abrir
              </motion.p>
            </div>
          </motion.button>
        )}

        {/* ─── Abriendo ───────────────────────────────────────────────────── */}
        {phase === "opening" && (
          <motion.div
            key="opening"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
          >
            <motion.span
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: [1, 1.3, 0.4], rotate: [0, -8, 12], opacity: [1, 1, 0] }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              style={{ fontSize: 128, position: "absolute" }}
            >
              🎁
            </motion.span>
            {["✨", "🧡", "✨", "💫", "🧡", "✨"].map((e, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos((i / 6) * Math.PI * 2) * 150,
                  y: Math.sin((i / 6) * Math.PI * 2) * 150,
                  scale: [0.5, 1.2, 0.8],
                }}
                transition={{ duration: 1.3, delay: 0.15, ease: "easeOut" }}
                style={{ fontSize: 34, position: "absolute" }}
              >
                {e}
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* ─── Carta (con giro) ───────────────────────────────────────────── */}
        {phase === "letter" && (
          <motion.div
            key="letter"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "6px 16px 16px", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
          >
            <LetterCard s={s} celebrate />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LA CARTA — tarjeta que se gira (frente: carta · reverso: fotos)
   ══════════════════════════════════════════════════════════════════════════ */
function LetterCard({ s, height, celebrate = false }: { s: Sorpresa; height?: string | number; celebrate?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  const fotos = s.fotos ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: height ?? "100%", minHeight: 0, flex: height ? undefined : 1 }}>
      <div style={{ perspective: 2200, flex: 1, minHeight: 0 }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "relative", width: "100%", height: "100%",
            transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d",
          }}
        >
          {/* FRENTE — la carta */}
          <div style={FACE}>
            {celebrate && !flipped && <FloatingHearts />}
            <LetterPaper s={s} />
          </div>

          {/* REVERSO — las fotos */}
          <div style={{ ...FACE, transform: "rotateY(180deg)" }}>
            <PhotoPaper fotos={fotos} caption={s.foto_caption} />
          </div>
        </motion.div>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        style={{
          flexShrink: 0, alignSelf: "center",
          display: "inline-flex", alignItems: "center", gap: 9,
          padding: "11px 22px", borderRadius: 24, border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${WINE}, ${ROSE})`,
          color: "white", fontSize: 13.5, fontWeight: 800, letterSpacing: "0.02em",
          boxShadow: `0 5px 18px ${ROSE}55`,
        }}
      >
        <motion.span animate={{ rotate: flipped ? -180 : 0 }} transition={{ duration: 0.9 }} style={{ fontSize: 15 }}>🔄</motion.span>
        {flipped ? "Volver a la carta" : "Gira para descubrir"}
      </button>
    </div>
  );
}

const FACE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  borderRadius: 20,
  overflow: "hidden",
  boxShadow: "0 12px 44px rgba(120,40,60,0.2), inset 0 0 0 1px rgba(201,169,110,0.35)",
};

const FACE_SCROLL: React.CSSProperties = {
  height: "100%",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  position: "relative",
};

/* ─── Frente: la carta ─────────────────────────────────────────────────────── */
function LetterPaper({ s }: { s: Sorpresa }) {
  return (
    <div style={{ ...FACE_SCROLL, background: "linear-gradient(160deg, #fffdf7 0%, #fdf3e9 100%)", padding: "30px 22px 28px" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg, ${GOLD}, ${ROSE}, ${GOLD})` }} />

      <div style={{ textAlign: "center", marginBottom: 20, position: "relative", zIndex: 1 }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: ROSE, letterSpacing: "0.22em", textTransform: "uppercase", margin: "0 0 8px" }}>
          Una carta
        </p>
        <h2 style={{ fontFamily: SCRIPT_ELEGANT, fontSize: 33, color: WINE, margin: 0, lineHeight: 1.15 }}>
          {s.titulo || "Para Rut"}
        </h2>
        <div style={{ width: 54, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, margin: "12px auto 0" }} />
      </div>

      <p style={{
        fontFamily: SCRIPT,
        fontSize: 17.5,
        lineHeight: 1.8,
        color: s.cuerpo ? "#3a2a2a" : "#c3b09b",
        margin: 0,
        whiteSpace: "pre-wrap",
        position: "relative",
        zIndex: 1,
      }}>
        {s.cuerpo || "Aquí irá tu carta…"}
      </p>

      <div style={{ marginTop: 24, textAlign: "right", position: "relative", zIndex: 1 }}>
        {s.firma_nombre && (
          <p style={{ fontFamily: SCRIPT_ELEGANT, fontSize: 21, color: WINE, margin: "0 0 4px" }}>{s.firma_nombre}</p>
        )}
        {s.firma_url && (
          <img src={s.firma_url} alt="Firma" style={{ maxHeight: 68, maxWidth: "70%", objectFit: "contain", display: "inline-block" }} />
        )}
        {s.firma_at && (
          <p style={{ fontSize: 10.5, color: "#a98", margin: "2px 0 0" }}>{fmtFechaLarga(s.firma_at)}</p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 22, position: "relative", zIndex: 1 }}>
        <div style={{ width: 78, height: 78, borderRadius: "50%", border: `2px solid ${ROSE}99`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(-10deg)" }}>
          <span style={{ fontSize: 8.5, fontWeight: 800, color: `${ROSE}cc`, textTransform: "uppercase", letterSpacing: "0.08em" }}>Con</span>
          <span style={{ fontSize: 18 }}>🧡</span>
          <span style={{ fontSize: 8.5, fontWeight: 800, color: `${ROSE}cc`, textTransform: "uppercase", letterSpacing: "0.08em" }}>Amor</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Reverso: las fotos ───────────────────────────────────────────────────── */
function PhotoPaper({ fotos, caption }: { fotos: string[]; caption: string }) {
  return (
    <div style={{ ...FACE_SCROLL, background: "linear-gradient(160deg, #fdeee2 0%, #f6e0d0 100%)", padding: "30px 22px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg, ${GOLD}, ${ROSE}, ${GOLD})` }} />

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: ROSE, letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 6px" }}>
          Y esto me he hecho
        </p>
        <p style={{ fontFamily: SCRIPT_ELEGANT, fontSize: 26, color: WINE, margin: 0, lineHeight: 1.2 }}>
          Me he tatuado algo tuyo
        </p>
        <span style={{ fontSize: 22 }}>🧡</span>
      </div>

      {fotos.length === 0 ? (
        <div style={{ width: "100%", maxWidth: 260, aspectRatio: "4 / 5", borderRadius: 12, border: `2px dashed ${ROSE}55`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.4)" }}>
          <p style={{ fontSize: 13, color: `${WINE}99`, fontStyle: "italic", textAlign: "center", padding: "0 20px" }}>
            Aquí irán las fotos del tatuaje
          </p>
        </div>
      ) : (
        fotos.map((url, i) => (
          <motion.figure
            key={url}
            initial={{ rotate: 0, opacity: 0, scale: 0.94 }}
            animate={{ rotate: i % 2 ? 2.4 : -2.4, opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 180, damping: 18 }}
            style={{ margin: 0, background: "white", padding: "10px 10px 14px", boxShadow: "0 8px 26px rgba(0,0,0,0.22)", maxWidth: 260 }}
          >
            <img src={url} alt="El tatuaje" style={{ width: "100%", display: "block", objectFit: "cover" }} />
          </motion.figure>
        ))
      )}

      {caption && (
        <p style={{ fontFamily: SCRIPT, fontSize: 18, color: "#5a3a3a", textAlign: "center", lineHeight: 1.4, margin: "2px 0 0" }}>
          {caption}
        </p>
      )}
    </div>
  );
}

/* ─── Corazones flotantes ──────────────────────────────────────────────────── */
function FloatingHearts() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 2 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: "-20%", opacity: [0, 0.5, 0] }}
          transition={{ duration: 6 + (i % 3), repeat: Infinity, delay: i * 0.9, ease: "easeIn" }}
          style={{ position: "absolute", left: `${8 + i * 13}%`, fontSize: 13 + (i % 3) * 5 }}
        >
          {i % 2 ? "🧡" : "🩷"}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── UI helpers ───────────────────────────────────────────────────────────── */
function Shell({ children, router }: { children: React.ReactNode; router: ReturnType<typeof useRouter> }) {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: PAPER_BG, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", paddingTop: "calc(14px + env(safe-area-inset-top))", flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: `${GOLD}30`, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke={WINE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px" }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9a7b62", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>{label}</p>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${GOLD}66`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  color: "#3a2a2a",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
