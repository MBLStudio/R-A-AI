"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { getDailyMessage } from "@/lib/daily-content";

const SHARED_MODULES = [
  { id: "carnet", icon: "💕", title: "Nuestros carnets", description: "Alejandro & Rut · pareja oficial", color: "linear-gradient(135deg, #1C1C1E 0%, #FF2D55 100%)" },
  { id: "contrato", icon: "📜", title: "Contrato de pareja", description: "Nuestro pacto oficial · firmado", color: "linear-gradient(135deg, #8b5a2b 0%, #c9a96e 100%)" },
  { id: "intimidad", icon: "🔐", title: "Secretos", description: "Solo vosotros lo veis", color: "linear-gradient(135deg, #FF2D55 0%, #C1135A 100%)" },
  { id: "plans", icon: "💑", title: "Planes", description: "Cread el plan perfecto juntos", color: "linear-gradient(135deg, #FF2D55 0%, #FF6B35 100%)" },
  { id: "viajes", icon: "🌍", title: "Viajes", description: "Descubrid el mundo juntos", color: "linear-gradient(135deg, #007AFF 0%, #34C759 100%)" },
  { id: "tarro", icon: "🫙", title: "Tarro de momentos", description: "Guardad lo que os importa", color: "linear-gradient(135deg, #AF52DE 0%, #FF9F0A 100%)" },
];

const ALEJANDRO_PERSONAL = [
  { id: "cartas", icon: "💌", title: "Cartas", description: "Escríbele cuando quieras" },
];

const RUT_PERSONAL = [
  { id: "cartas", icon: "💌", title: "Cartas", description: "Escríbele cuando quieras" },
  { id: "tfg", icon: "🎓", title: "TFG", description: "Redacción, APA, análisis" },
];

export default function HomePage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const userParam = params.user as UserName;

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  const isAlejandro = userParam === "alejandro";
  const displayName = isAlejandro ? "Alejandro" : "Rut";
  const accentColor = isAlejandro ? "#1C1C1E" : "#FF2D55";
  const personalModules = isAlejandro ? ALEJANDRO_PERSONAL : RUT_PERSONAL;

  const dailyMessage = getDailyMessage();

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          padding: "16px 20px 12px",
          paddingTop: `calc(16px + env(safe-area-inset-top))`,
          background: "rgba(242,242,247,0.85)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          flexShrink: 0, zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, fontWeight: 400 }}>{getGreeting()}</p>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "1px 0 0", letterSpacing: "-0.5px" }}>
              {displayName}
            </h1>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ width: 44, height: 44, borderRadius: "50%", background: accentColor, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", overflow: "hidden" }}
          >
            <img
              src={isAlejandro ? "/avatar_alejandro.png" : "/avatar_rut.png"}
              alt={displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </button>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, background: "rgba(52,199,89,0.12)", border: "1px solid rgba(52,199,89,0.25)", borderRadius: 20, padding: "4px 10px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34C759" }} />
          <span style={{ fontSize: 11, color: "#34C759", fontWeight: 600 }}>R&A activo</span>
        </div>
      </motion.div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: `calc(84px + env(safe-area-inset-bottom))` }}>

        {/* Mensaje del día */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          style={{
            marginBottom: 22, borderRadius: 24,
            background: "linear-gradient(135deg, #FF2D55 0%, #C42B5B 100%)",
            padding: "20px 22px",
            boxShadow: "0 8px 28px rgba(255,45,85,0.26)",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
            💗 Para los dos · hoy
          </p>
          <p style={{ fontSize: 16, fontWeight: 400, color: "white", margin: 0, lineHeight: 1.65, fontStyle: "italic" }}>
            "{dailyMessage}"
          </p>
        </motion.div>

        {/* Proyecto Barcelona */}
        <motion.button
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push(`/${userParam}/barcelona`)}
          style={{
            width: "100%", marginBottom: 24, border: "none", cursor: "pointer", textAlign: "left",
            borderRadius: 24, padding: "22px 24px", position: "relative", overflow: "hidden",
            background: "linear-gradient(140deg, #8E3A20 0%, #C1502E 48%, #E8A33D 100%)",
            boxShadow: "0 8px 30px rgba(193,80,46,0.32)",
          }}
        >
          {/* Trencadís */}
          <svg viewBox="0 0 110 100" preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
            {[
              { x: 8, y: 12, w: 26, h: 20, r: -12, o: 0.1 },
              { x: 46, y: 32, w: 34, h: 16, r: 8, o: 0.07 },
              { x: 80, y: 8, w: 20, h: 26, r: 22, o: 0.09 },
              { x: 22, y: 56, w: 30, h: 22, r: 16, o: 0.06 },
              { x: 64, y: 66, w: 24, h: 18, r: -18, o: 0.08 },
            ].map((p, i) => (
              <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={3} fill="white" opacity={p.o}
                transform={`rotate(${p.r} ${p.x + p.w / 2} ${p.y + p.h / 2})`} />
            ))}
          </svg>

          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 8px" }}>
              🇪🇸 Proyecto Barcelona
            </p>
            <p style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 27, fontWeight: 400, color: "white", margin: 0, lineHeight: 1.12, letterSpacing: "-0.4px" }}>
              Catalanes por<br />una temporada
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "9px 0 0", lineHeight: 1.5, maxWidth: 300 }}>
              Vuestra etapa: dónde vivís, qué descubrís y cómo lo recordaréis.
            </p>
          </div>
        </motion.button>

        {/* Con Rut / Con Alejandro */}
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text={isAlejandro ? "Con Rut" : "Con Alejandro"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SHARED_MODULES.map((mod, i) => (
              <CompactCard key={mod.id} mod={mod} userParam={userParam} delay={0.1 + i * 0.04} router={router} />
            ))}
          </div>
        </section>

        {/* Solo tú */}
        <section style={{ marginBottom: 24 }}>
          <SectionLabel text="Solo tú" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {personalModules.map((mod, i) => (
              <PersonalCard key={mod.id} mod={mod} userParam={userParam} delay={0.1 + i * 0.06} router={router} isAlejandro={isAlejandro} />
            ))}
          </div>
        </section>

        {/* Ver al otro */}
        <section>
          <SectionLabel text={isAlejandro ? "Ver a Rut" : "Ver a Alejandro"} />
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 24 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(isAlejandro ? "/rut" : "/alejandro")}
            style={{ width: "100%", background: isAlejandro ? "linear-gradient(135deg, #FF2D55 0%, #AF52DE 100%)" : "linear-gradient(135deg, #1C1C1E 0%, #3A3A3C 100%)", border: "none", borderRadius: 18, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", boxShadow: "0 4px 18px rgba(0,0,0,0.15)" }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src={isAlejandro ? "/avatar_rut.png" : "/avatar_alejandro.png"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "white", margin: 0 }}>{isAlejandro ? "Ver todo de Rut" : "Ver todo de Alejandro"}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>Módulos, conversaciones y más</p>
            </div>
            <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.5)", fontSize: 20 }}>›</div>
          </motion.button>
        </section>
      </div>

      <BottomNav userParam={userParam} router={router} />
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>{text}</p>;
}

function CompactCard({ mod, userParam, delay, router }: any) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26, delay }}
      whileTap={{ scale: 0.94 }}
      onClick={() => router.push(`/${userParam}/${mod.id}`)}
      style={{ background: mod.color, border: "none", borderRadius: 18, padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, cursor: "pointer", textAlign: "left", boxShadow: "0 3px 14px rgba(0,0,0,0.12)", minHeight: 96 }}
    >
      <span style={{ fontSize: 24 }}>{mod.icon}</span>
      <p style={{ fontSize: 13, fontWeight: 700, color: "white", margin: 0, lineHeight: 1.3 }}>{mod.title}</p>
    </motion.button>
  );
}

function PersonalCard({ mod, userParam, delay, router, isAlejandro }: any) {
  const isCartas = mod.id === "cartas";
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24, delay }}
      whileTap={{ scale: 0.97 }}
      onClick={() => router.push(`/${userParam}/${mod.id}`)}
      style={{ background: isCartas ? "linear-gradient(135deg, #7A1231 0%, #C42B5B 100%)" : "white", border: isCartas ? "none" : "1px solid rgba(0,0,0,0.07)", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", textAlign: "left", boxShadow: isCartas ? "0 6px 24px rgba(196,43,91,0.28)" : "0 2px 10px rgba(0,0,0,0.06)", width: "100%" }}
    >
      <span style={{ fontSize: 30, flexShrink: 0 }}>{mod.icon}</span>
      <div>
        <p style={{ fontSize: 16, fontWeight: 700, color: isCartas ? "white" : "var(--text-primary)", margin: 0, letterSpacing: "-0.2px" }}>{mod.title}</p>
        <p style={{ fontSize: 12, color: isCartas ? "rgba(255,255,255,0.65)" : "var(--text-tertiary)", margin: "2px 0 0" }}>{mod.description}</p>
      </div>
      <div style={{ marginLeft: "auto", color: isCartas ? "rgba(255,255,255,0.5)" : "var(--text-quaternary)", fontSize: 18 }}>›</div>
    </motion.button>
  );
}

function BottomNav({ userParam, router }: { userParam: string; router: any }) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-around", alignItems: "center", paddingBottom: "env(safe-area-inset-bottom)", paddingTop: 8, zIndex: 100 }}>
      {[
        { icon: "⊞", label: "Inicio", href: `/${userParam}` },
        { icon: "👤", label: "Perfil", href: `/${userParam}/profile` },
      ].map((item) => (
        <button key={item.href} onClick={() => router.push(item.href)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 20px", background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}
        >
          <span style={{ fontSize: 22 }}>{item.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return "Buenas noches";
  if (h < 14) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}
