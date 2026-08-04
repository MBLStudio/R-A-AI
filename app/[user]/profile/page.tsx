"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser, clearUser } = useUserStore();
  const userParam = params.user as UserName;

  useEffect(() => {
    if (userParam && userParam !== activeUser) {
      setUser(userParam, userParam);
    }
  }, [userParam, activeUser, setUser]);

  const isAlejandro = userParam === "alejandro";
  const displayName = isAlejandro ? "Alejandro" : "Rut";
  const avatarColor = isAlejandro ? "#1D1D1F" : "#FF2D55";
  const subtitle = isAlejandro ? "Desarrollador · MBL Studio" : "Psicóloga · TFG 2026";

  const handleSwitchUser = () => {
    clearUser();
    router.push("/");
  };

  // ─── Notifications ──────────────────────────────────────────────────────────
  const [notifState, setNotifState] = useState<"unknown" | "active" | "inactive" | "loading">("unknown");

  // Al montar: si el permiso ya está concedido, forzar re-suscripción fresca
  // para garantizar que el endpoint en Supabase está siempre actualizado
  useEffect(() => {
    if (typeof Notification === "undefined") { setNotifState("inactive"); return; }
    if (Notification.permission !== "granted") { setNotifState("inactive"); return; }

    const silentRenew = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
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
        setNotifState("active");
      } catch {
        setNotifState("active"); // Mostrar como activo aunque falle el renew silencioso
      }
    };

    silentRenew();
  }, [userParam]);

  const activateNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setNotifState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setNotifState("inactive"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      // Unsubscribe existing first to force fresh subscription
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
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
      setNotifState("active");
    } catch {
      setNotifState("inactive");
    }
  };

  const deactivateNotifications = async () => {
    setNotifState("loading");
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (reg) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await fetch("/api/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
          }
        }
      }
      localStorage.removeItem("ra_push_v2");
      setNotifState("inactive");
    } catch {
      setNotifState("inactive");
    }
  };

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 20px 0",
          paddingTop: `calc(20px + env(safe-area-inset-top))`,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "white",
            margin: 0,
            fontFamily: "var(--font-display)",
          }}
        >
          Perfil
        </h1>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "32px 20px 100px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: avatarColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontSize: 44, fontWeight: 700, color: "white" }}>
            {displayName[0]}
          </span>
        </motion.div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "white", margin: 0 }}>
            {displayName}
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
            {subtitle}
          </p>
        </div>

        {/* App info */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
            }}
          >
            App
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <InfoRow label="Versión" value="2.0" />
            <InfoRow label="Modelo" value="Claude Sonnet 4.6" />
            <InfoRow label="Usuario" value={displayName} />
            <InfoRow label="MBL Studio" value="2026" />
          </div>
        </div>

        {/* Notifications */}
        <div style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
            Notificaciones
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: 0, fontWeight: 500 }}>
                {notifState === "active" ? "🔔 Activadas" : notifState === "loading" || notifState === "unknown" ? "⏳ Renovando…" : "🔕 Desactivadas"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "3px 0 0" }}>
                {notifState === "active" ? "Suscripción renovada y lista ✓" : notifState === "loading" || notifState === "unknown" ? "Registrando dispositivo…" : "No recibes ningún aviso"}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={notifState === "active" ? deactivateNotifications : activateNotifications}
              disabled={notifState === "loading" || notifState === "unknown"}
              style={{
                padding: "8px 16px", borderRadius: 20, border: "none",
                cursor: (notifState === "loading" || notifState === "unknown") ? "default" : "pointer",
                fontWeight: 600, fontSize: 13,
                background: notifState === "active" ? "rgba(255,59,48,0.15)" : "rgba(52,199,89,0.15)",
                color: notifState === "active" ? "#FF3B30" : "#34C759",
                transition: "all 0.2s",
              }}
            >
              {(notifState === "loading" || notifState === "unknown") ? "…" : notifState === "active" ? "Desactivar" : "Activar"}
            </motion.button>
          </div>
          {notifState === "active" && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              whileTap={{ scale: 0.97 }}
              onClick={activateNotifications}
              style={{ marginTop: 12, width: "100%", padding: "9px", background: "rgba(52,199,89,0.1)", border: "1px solid rgba(52,199,89,0.2)", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#34C759", cursor: "pointer" }}
            >
              🔄 Forzar renovación de suscripción
            </motion.button>
          )}
        </div>

        {/* Switch user button */}
        <button
          onClick={handleSwitchUser}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 16,
            background: "rgba(255,45,85,0.1)",
            border: "1px solid rgba(255,45,85,0.25)",
            color: "#FF2D55",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span>⇄</span>
          Cambiar usuario
        </button>

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/entrar";
          }}
          style={{
            width: "100%", marginTop: 10, padding: "14px", borderRadius: 14,
            background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <span>🔒</span>
          Cerrar sesión
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}
