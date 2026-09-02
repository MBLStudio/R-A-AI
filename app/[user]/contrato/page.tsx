"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { getBothProfiles, upsertProfile, type UserProfile } from "@/lib/profiles";
import { uploadPhoto } from "@/lib/upload";
import { SignaturePad } from "@/components/SignaturePad";

const CLAUSULAS = [
  { num: "I",    texto: "Me comprometo a responderte antes de que empieces a preocuparte (o al menos a avisarte de que estoy bien)." },
  { num: "II",   texto: "Me comprometo a compartir mis patatas fritas. La mayoría. Casi siempre." },
  { num: "III",  texto: "Me comprometo a mandarte memes a cualquier hora, incluyendo las 3 de la madrugada." },
  { num: "IV",   texto: "Me comprometo a no llevar la contraria cuando tengas hambre. Nunca. Jamás." },
  { num: "V",    texto: "Me comprometo a aguantar tus series aunque me parezcan un horror, y a fingir que me gustan." },
  { num: "VI",   texto: "Me comprometo a decirte que estás guapísima/guapísimo aunque vayas en pijama y con el pelo revuelto." },
  { num: "VII",  texto: "Me comprometo a hacer el viaje ridículo para verte cuando lo necesitemos, sin quejarme (mucho)." },
  { num: "VIII", texto: "Me comprometo a ser tu fan número uno en todo lo que hagas, aunque fracase estrepitosamente." },
  { num: "IX",   texto: "Me comprometo a no enfadarme más de lo necesario y a hablar contigo antes de irme a dormir enfadado/a." },
  { num: "X",    texto: "Me comprometo a seguir eligiéndote cada día. Incluso cuando seas imposible. Especialmente entonces." },
];

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default function ContratoPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const userParam = params.user as UserName;
  useEffect(() => { if (userParam !== activeUser) setUser(userParam, userParam); }, [userParam]);

  const isAle = userParam === "alejandro";

  const [profiles, setProfiles] = useState<{ alejandro: UserProfile | null; rut: UserProfile | null }>({ alejandro: null, rut: null });
  const [loading, setLoading] = useState(true);
  const [showPad, setShowPad] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const p = await getBothProfiles();
    setProfiles(p);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const aleProfile = profiles.alejandro;
  const rutProfile = profiles.rut;
  const bothSigned = !!(aleProfile?.firma_url && rutProfile?.firma_url);
  const mySig = isAle ? aleProfile?.firma_url : rutProfile?.firma_url;
  const mySigAt = isAle ? aleProfile?.firma_at : rutProfile?.firma_at;

  const handleSaveFirma = async (blob: Blob) => {
    setSaving(true);
    try {
      const file = new File([blob], "firma.png", { type: "image/png" });
      const url = await uploadPhoto(file, `firmas/${userParam}`);
      if (!url) throw new Error("No se pudo subir la firma");
      await upsertProfile(userParam, { firma_url: url, firma_at: new Date().toISOString() });
      await load();
      setShowPad(false);
    } catch (err: any) {
      alert("Error al guardar la firma: " + (err.message || "inténtalo de nuevo"));
    }
    setSaving(false);
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#f5ede0" }}>

      {/* Header */}
      <div style={{ padding: "14px 20px 12px", paddingTop: `calc(14px + env(safe-area-inset-top))`, background: "rgba(245,237,224,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(139,90,43,0.15)", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(139,90,43,0.1)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#6b4423" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#3d2010", margin: 0 }}>Contrato de Pareja 📜</h1>
            <p style={{ fontSize: 11, color: "#a07050", margin: 0 }}>Alejandro & Rut · 2026</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", paddingBottom: `calc(40px + env(safe-area-inset-bottom))` }}>

        {loading ? (
          <p style={{ textAlign: "center", color: "#a07050", marginTop: 60 }}>Cargando…</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            style={{
              background: "linear-gradient(160deg, #fdf6ec 0%, #f9edd8 100%)",
              borderRadius: 20,
              padding: "32px 24px",
              boxShadow: "0 8px 40px rgba(100,60,20,0.18), inset 0 0 0 1px rgba(139,90,43,0.2)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Ornamentos decorativos */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "linear-gradient(90deg, #8b5a2b, #c9a96e, #8b5a2b)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: "linear-gradient(90deg, #8b5a2b, #c9a96e, #8b5a2b)" }} />
            <div style={{ position: "absolute", top: 6, left: 0, bottom: 6, width: 4, background: "linear-gradient(180deg, #8b5a2b, #c9a96e, #8b5a2b)" }} />
            <div style={{ position: "absolute", top: 6, right: 0, bottom: 6, width: 4, background: "linear-gradient(180deg, #8b5a2b, #c9a96e, #8b5a2b)" }} />

            {/* Esquinas decorativas */}
            {["top", "bottom"].map((v) => ["left", "right"].map((h) => (
              <div key={`${v}-${h}`} style={{ position: "absolute", [v]: 4, [h]: 4, width: 20, height: 20, borderTop: v === "top" ? "3px solid #8b5a2b" : "none", borderBottom: v === "bottom" ? "3px solid #8b5a2b" : "none", borderLeft: h === "left" ? "3px solid #8b5a2b" : "none", borderRight: h === "right" ? "3px solid #8b5a2b" : "none" }} />
            )))}

            {/* Título */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#8b5a2b", letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 8px" }}>Documento Oficial</p>
              <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 700, color: "#3d2010", margin: "0 0 6px", lineHeight: 1.2 }}>
                Contrato de Pareja
              </h2>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 14, color: "#8b5a2b", margin: "0 0 4px", fontStyle: "italic" }}>
                entre Alejandro Bahillo y Rut
              </p>
              <div style={{ width: 60, height: 2, background: "linear-gradient(90deg, transparent, #8b5a2b, transparent)", margin: "12px auto 0" }} />
            </div>

            {/* Preámbulo */}
            <p style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#5a3a1a", lineHeight: 1.7, marginBottom: 20, textAlign: "justify", fontStyle: "italic" }}>
              Nosotros, Alejandro Bahillo y Rut, reunidos bajo el mismo cielo aunque a veces en distintos países, comprometemos libremente y con todo el amor del mundo a cumplir las siguientes cláusulas, so pena de perder puntos R&A y de que el otro lo saque en conversación durante los próximos diez años:
            </p>

            <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, #c9a96e, transparent)", marginBottom: 20 }} />

            {/* Cláusulas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {CLAUSULAS.map((c) => (
                <div key={c.num} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 12, fontWeight: 700, color: "#8b5a2b", minWidth: 28, marginTop: 1 }}>{c.num}.</span>
                  <p style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#4a2e10", lineHeight: 1.65, margin: 0, textAlign: "justify" }}>{c.texto}</p>
                </div>
              ))}
            </div>

            <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, #c9a96e, transparent)", marginBottom: 20 }} />

            {/* Cierre */}
            <p style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#5a3a1a", lineHeight: 1.7, marginBottom: 28, textAlign: "center", fontStyle: "italic" }}>
              Este contrato entra en vigor en el momento en que ambas partes estampen su firma, y su validez es eterna, irrevocable y absolutamente no vinculante en ningún juzgado del mundo, pero sí en nuestros corazones.
            </p>

            {/* Firmas */}
            <div style={{ display: "flex", gap: 16 }}>
              {[
                { name: "Alejandro", user: "alejandro", sig: aleProfile?.firma_url ?? null, sigAt: aleProfile?.firma_at ?? null },
                { name: "Rut",       user: "rut",       sig: rutProfile?.firma_url ?? null,  sigAt: rutProfile?.firma_at ?? null },
              ].map(({ name, user: u, sig, sigAt }) => {
                const isMe = userParam === u;
                return (
                  <div key={u} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {/* Área de firma */}
                    <div
                      onClick={isMe && !sig ? () => setShowPad(true) : undefined}
                      style={{ width: "100%", height: 80, borderBottom: "2px solid #8b5a2b", display: "flex", alignItems: "center", justifyContent: "center", cursor: isMe && !sig ? "pointer" : "default", position: "relative", background: sig ? "transparent" : isMe ? "rgba(139,90,43,0.04)" : "transparent", borderRadius: "4px 4px 0 0" }}
                    >
                      {sig ? (
                        <img src={sig} alt={`Firma ${name}`} style={{ maxHeight: 72, maxWidth: "100%", objectFit: "contain" }} />
                      ) : isMe ? (
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 20, margin: "0 0 2px" }}>✍️</p>
                          <p style={{ fontSize: 11, color: "#8b5a2b", fontWeight: 600, margin: 0 }}>Pulsa para firmar</p>
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "#c9a96e", fontStyle: "italic" }}>Pendiente…</p>
                      )}
                    </div>
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 13, color: "#5a3a1a", margin: 0, fontWeight: 600 }}>{name}</p>
                    {sigAt && <p style={{ fontSize: 10, color: "#a07050", margin: 0 }}>{fmt(sigAt)}</p>}
                    {isMe && sig && (
                      <button onClick={() => setShowPad(true)} style={{ fontSize: 10, color: "#8b5a2b", background: "rgba(139,90,43,0.08)", border: "1px solid rgba(139,90,43,0.2)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>Repetir firma</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sello */}
            {bothSigned && (
              <motion.div
                initial={{ scale: 0, rotate: -15, opacity: 0 }}
                animate={{ scale: 1, rotate: -12, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.3 }}
                style={{ position: "absolute", bottom: 90, right: 20, width: 80, height: 80, borderRadius: "50%", border: "3px solid rgba(220,50,50,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.1)", pointerEvents: "none" }}
              >
                <p style={{ fontSize: 8, fontWeight: 800, color: "rgba(200,40,40,0.7)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0, textAlign: "center", lineHeight: 1.3 }}>R&A</p>
                <p style={{ fontSize: 16, margin: "1px 0" }}>💕</p>
                <p style={{ fontSize: 7, fontWeight: 700, color: "rgba(200,40,40,0.7)", textTransform: "uppercase", letterSpacing: "0.03em", margin: 0 }}>FIRMADO</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Pad de firma */}
      <AnimatePresence>
        {showPad && (
          <SignaturePad
            onSave={handleSaveFirma}
            onCancel={() => setShowPad(false)}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
