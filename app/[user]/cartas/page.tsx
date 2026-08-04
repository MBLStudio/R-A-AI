"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import {
  saveCarta,
  loadCartasEnviadas,
  loadCartasRecibidas,
  markCartaRead,
  toggleFavorito,
  todayDateStr,
  type Carta,
} from "@/lib/cartas";

const ACCENT = "#FF2D55";

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default function CartasPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const userParam = params.user as UserName;
  const isAlejandro = userParam === "alejandro";
  const otherUser = isAlejandro ? "rut" : "alejandro";

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  const [tab, setTab] = useState<"recibidas" | "enviadas">("recibidas");
  const [recibidas, setRecibidas] = useState<Carta[]>([]);
  const [enviadas, setEnviadas] = useState<Carta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCartasRecibidas(userParam), loadCartasEnviadas(userParam)]).then(([r, e]) => {
      setRecibidas(r);
      setEnviadas(e);
      setLoading(false);
    });
  }, [userParam]);

  // ─── Open carta ───────────────────────────────────────────────────────────
  const [openId, setOpenId] = useState<string | null>(null);

  const openCarta = async (carta: Carta) => {
    setOpenId(carta.id);
    if (!carta.read_at) {
      await markCartaRead(carta.id);
      setRecibidas((prev) => prev.map((c) => c.id === carta.id ? { ...c, read_at: new Date().toISOString() } : c));
    }
  };

  // ─── Favorito ─────────────────────────────────────────────────────────────
  const handleFavorito = async (carta: Carta, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavorito(carta.id, carta.favorito);
    const update = (prev: Carta[]) => prev.map((c) => c.id === carta.id ? { ...c, favorito: !c.favorito } : c);
    setRecibidas(update);
    setEnviadas(update);
  };

  // ─── Compose ──────────────────────────────────────────────────────────────
  const [composing, setComposing] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composeDate, setComposeDate] = useState<"hoy" | "fecha">("hoy");
  const [composeDateValue, setComposeDateValue] = useState(todayDateStr());
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const text = composeText.trim();
    if (!text) return;
    setSending(true);
    const deliverAt = composeDate === "hoy" ? todayDateStr() : composeDateValue;
    const carta = await saveCarta(userParam, otherUser, text, deliverAt);
    if (carta) {
      setEnviadas((prev) => [carta, ...prev]);
      if (deliverAt === todayDateStr()) {
        fetch("/api/push/carta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toUser: otherUser }),
        }).catch(() => {});
      }
    }
    setComposeText("");
    setComposeDate("hoy");
    setComposeDateValue(todayDateStr());
    setComposing(false);
    setSending(false);
    setTab("enviadas");
  };

  // ─── Notifications ────────────────────────────────────────────────────────
  const [notifStatus, setNotifStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotifStatus("ok");
      // Silently renew subscription
      if ("serviceWorker" in navigator && "PushManager" in window) {
        navigator.serviceWorker.register("/sw.js").then(async (reg) => {
          await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
          });
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON(), userName: userParam }),
          });
        }).catch(() => {});
      }
    }
  }, [userParam]);

  const subscribeNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setNotifStatus("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setNotifStatus("denied"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userName: userParam }),
      });
      localStorage.setItem("ra_push_v2", "granted");
      setNotifStatus("ok");
    } catch {
      setNotifStatus("idle");
    }
  };

  const recibidasFav = recibidas.filter((c) => c.favorito);
  const recibidasRest = recibidas.filter((c) => !c.favorito);
  const enviadasFav = enviadas.filter((c) => c.favorito);
  const enviadasRest = enviadas.filter((c) => !c.favorito);
  const openCarta2 = [...recibidas, ...enviadas].find((c) => c.id === openId) ?? null;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        style={{
          padding: "14px 20px 10px", paddingTop: `calc(14px + env(safe-area-inset-top))`,
          background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0, zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()}
            style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.3px" }}>Cartas 💌</h1>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>{isAlejandro ? "Tú y Rut" : "Tú y Alejandro"}</p>
          </div>

          {/* Notification bell — force re-subscribe */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={subscribeNotifications}
            style={{
              width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: notifStatus === "ok" ? "rgba(52,199,89,0.12)" : notifStatus === "denied" ? "rgba(255,59,48,0.1)" : "rgba(0,0,0,0.06)",
            }}
          >
            {notifStatus === "loading" ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                style={{ width: 14, height: 14, border: "2px solid #FF2D5530", borderTopColor: ACCENT, borderRadius: "50%" }}
              />
            ) : (
              <motion.span
                animate={notifStatus !== "ok" ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
                transition={{ duration: 1.5, repeat: notifStatus === "idle" ? Infinity : 0, repeatDelay: 4 }}
                style={{ fontSize: 16 }}
              >{notifStatus === "denied" ? "🔕" : "🔔"}</motion.span>
            )}
          </motion.button>

          {/* Compose */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setComposing(true)}
            style={{
              width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${ACCENT}, #FF6B35)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px rgba(255,45,85,0.3)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </motion.button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 12, background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3 }}>
          {([["recibidas", "💌 Recibidas"], ["enviadas", "📤 Enviadas"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: "7px 12px", borderRadius: 8, border: "none",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
              background: tab === id ? "white" : "transparent",
              color: tab === id ? ACCENT : "var(--text-tertiary)",
              boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}>{label}</button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === "recibidas" ? (
          <motion.div key="rec"
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
            style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: `calc(90px + env(safe-area-inset-bottom))` }}
          >
            {loading ? <LoadingState /> : recibidas.length === 0 ? (
              <EmptyState icon="💌" text={`Aún no tienes cartas de ${isAlejandro ? "Rut" : "Alejandro"}`} sub="Llegarán cuando las escriba 💗" />
            ) : <>
              {recibidasFav.length > 0 && (
                <section style={{ marginBottom: 22 }}>
                  <SectionLabel text="⭐ Favoritas" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {recibidasFav.map((c, i) => <CartaCard key={c.id} carta={c} index={i} onOpen={() => openCarta(c)} onFav={(e) => handleFavorito(c, e)} />)}
                  </div>
                </section>
              )}
              {recibidasRest.length > 0 && (
                <section>
                  {recibidasFav.length > 0 && <SectionLabel text="Todas" />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {recibidasRest.map((c, i) => <CartaCard key={c.id} carta={c} index={i} onOpen={() => openCarta(c)} onFav={(e) => handleFavorito(c, e)} />)}
                  </div>
                </section>
              )}
            </>}
          </motion.div>
        ) : (
          <motion.div key="env"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.22 }}
            style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: `calc(90px + env(safe-area-inset-bottom))` }}
          >
            {loading ? <LoadingState /> : enviadas.length === 0 ? (
              <EmptyState icon="✏️" text="Aún no has enviado ninguna carta" sub="Pulsa + para escribir la primera 💗" />
            ) : <>
              {enviadasFav.length > 0 && (
                <section style={{ marginBottom: 22 }}>
                  <SectionLabel text="⭐ Favoritas" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {enviadasFav.map((c, i) => <CartaEnviadaCard key={c.id} carta={c} index={i} onOpen={() => setOpenId(c.id)} onFav={(e) => handleFavorito(c, e)} />)}
                  </div>
                </section>
              )}
              {enviadasRest.length > 0 && (
                <section>
                  {enviadasFav.length > 0 && <SectionLabel text="Todas" />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {enviadasRest.map((c, i) => <CartaEnviadaCard key={c.id} carta={c} index={i} onOpen={() => setOpenId(c.id)} onFav={(e) => handleFavorito(c, e)} />)}
                  </div>
                </section>
              )}
            </>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open carta modal */}
      <AnimatePresence>
        {openCarta2 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#FFFDF5", borderRadius: 24, padding: "28px 24px",
                width: "100%", maxWidth: 380,
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                maxHeight: "80vh", overflowY: "auto",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <motion.span
                  initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 18 }}
                  style={{ fontSize: 40 }}
                >💌</motion.span>
              </div>

              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 4px", textAlign: "center" }}>
                {openCarta2.from_user === userParam
                  ? `Para ${openCarta2.to_user === "rut" ? "Rut" : "Alejandro"}`
                  : `De ${openCarta2.from_user === "rut" ? "Rut" : "Alejandro"}`}
              </p>
              <p style={{ fontSize: 11, color: "var(--text-quaternary)", margin: "0 0 22px", textAlign: "center" }}>
                {formatDate(openCarta2.deliver_at)}
              </p>

              <motion.p
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                style={{ fontSize: 16, lineHeight: 1.75, color: "#1C1C1E", margin: 0, whiteSpace: "pre-wrap", fontStyle: "italic" }}
              >
                {openCarta2.text}
              </motion.p>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                <motion.button whileTap={{ scale: 0.85 }}
                  onClick={(e) => handleFavorito(openCarta2, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 26, padding: 4 }}
                >
                  {openCarta2.favorito ? "⭐" : "☆"}
                </motion.button>
                <button onClick={() => setOpenId(null)}
                  style={{ background: "rgba(0,0,0,0.07)", border: "none", borderRadius: 20, padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose sheet */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setComposing(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white", borderRadius: "24px 24px 0 0",
                padding: "24px 20px", paddingBottom: `calc(24px + env(safe-area-inset-bottom))`,
                width: "100%",
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)", margin: "0 auto 20px" }} />

              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>Escribir una carta 💌</h2>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 16px" }}>
                Para {otherUser === "rut" ? "Rut" : "Alejandro"}
              </p>

              <textarea
                autoFocus value={composeText} onChange={(e) => setComposeText(e.target.value)}
                placeholder="Escribe lo que sientas…"
                rows={6}
                style={{
                  width: "100%", background: "#FAFAFA", border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 14, padding: "12px 14px", fontSize: 14, color: "var(--text-primary)",
                  resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6,
                }}
              />

              <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
                {(["hoy", "fecha"] as const).map((opt) => (
                  <button key={opt} onClick={() => setComposeDate(opt)} style={{
                    flex: 1, padding: "9px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, transition: "all 0.2s",
                    background: composeDate === opt ? ACCENT : "rgba(0,0,0,0.05)",
                    color: composeDate === opt ? "white" : "var(--text-secondary)",
                  }}>
                    {opt === "hoy" ? "📬 Enviar hoy" : "📅 Fecha específica"}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {composeDate === "fecha" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden", marginBottom: 14 }}
                  >
                    <input type="date" value={composeDateValue} min={todayDateStr()}
                      onChange={(e) => setComposeDateValue(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 12,
                        border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none",
                        fontFamily: "inherit", boxSizing: "border-box", color: "var(--text-primary)",
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSend}
                disabled={!composeText.trim() || sending}
                style={{
                  width: "100%", padding: "14px",
                  background: composeText.trim() ? `linear-gradient(135deg, ${ACCENT}, #FF6B35)` : "rgba(0,0,0,0.08)",
                  border: "none", borderRadius: 14, cursor: composeText.trim() ? "pointer" : "default",
                  fontSize: 15, fontWeight: 700,
                  color: composeText.trim() ? "white" : "var(--text-quaternary)",
                  transition: "all 0.2s",
                }}
              >
                {sending ? "Enviando…" : composeDate === "hoy" ? "Enviar ahora 💌" : `Programar para el ${composeDateValue ? formatDate(composeDateValue) : "…"}`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom)", paddingTop: 8, zIndex: 100,
      }}>
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
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>{text}</p>;
}

function LoadingState() {
  return <p style={{ textAlign: "center", color: "var(--text-quaternary)", fontSize: 13, marginTop: 40 }}>Cargando…</p>;
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
      style={{ textAlign: "center", paddingTop: 60 }}
    >
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>{text}</p>
      <p style={{ fontSize: 13, color: "var(--text-quaternary)", margin: 0 }}>{sub}</p>
    </motion.div>
  );
}

function CartaCard({ carta, index, onOpen, onFav }: { carta: Carta; index: number; onOpen: () => void; onFav: (e: React.MouseEvent) => void }) {
  const unread = !carta.read_at;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }} onClick={onOpen}
      style={{
        background: unread ? "linear-gradient(135deg, #FFF0F3, #FFF5F0)" : "white",
        border: unread ? "1px solid rgba(255,45,85,0.2)" : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 18, padding: "16px", display: "flex", alignItems: "center", gap: 14,
        cursor: "pointer", textAlign: "left", width: "100%",
        boxShadow: unread ? "0 4px 16px rgba(255,45,85,0.1)" : "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <motion.span
        animate={unread ? { rotate: [-5, 5, -5] } : {}}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        style={{ fontSize: 28, flexShrink: 0 }}
      >{unread ? "💌" : "📩"}</motion.span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: unread ? 700 : 600, color: "var(--text-primary)", margin: "0 0 3px" }}>
          {unread ? "Nueva carta 💗" : formatDate(carta.deliver_at)}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {carta.text.slice(0, 55)}{carta.text.length > 55 ? "…" : ""}
        </p>
        {unread && <p style={{ fontSize: 10, color: "rgba(255,45,85,0.6)", fontWeight: 600, margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sin leer · {formatDate(carta.deliver_at)}</p>}
      </div>
      <motion.button whileTap={{ scale: 0.85 }} onClick={onFav}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, flexShrink: 0, padding: 4 }}
      >{carta.favorito ? "⭐" : "☆"}</motion.button>
    </motion.button>
  );
}

function CartaEnviadaCard({ carta, index, onOpen, onFav }: { carta: Carta; index: number; onOpen: () => void; onFav: (e: React.MouseEvent) => void }) {
  const today = todayDateStr();
  const delivered = carta.deliver_at <= today;
  const read = !!carta.read_at;
  const statusIcon = read ? "✓✓" : delivered ? "✓" : "🕐";
  const statusColor = read ? "#34C759" : delivered ? "#007AFF" : "var(--text-quaternary)";
  const statusText = read ? "Leída" : delivered ? "Entregada, sin leer" : `Llega el ${formatDate(carta.deliver_at)}`;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }} onClick={onOpen}
      style={{
        background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 18, padding: "16px",
        display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", width: "100%",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <span style={{ fontSize: 26, flexShrink: 0 }}>📤</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {carta.text.slice(0, 55)}{carta.text.length > 55 ? "…" : ""}
        </p>
        <p style={{ fontSize: 11, color: statusColor, fontWeight: 600, margin: 0 }}>{statusIcon} {statusText}</p>
      </div>
      <motion.button whileTap={{ scale: 0.85 }} onClick={onFav}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, flexShrink: 0, padding: 4 }}
      >{carta.favorito ? "⭐" : "☆"}</motion.button>
    </motion.button>
  );
}
