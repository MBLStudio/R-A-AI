"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

export default function EntrarPage() {
  return (
    <Suspense fallback={<Fondo />}>
      <Formulario />
    </Suspense>
  );
}

function Formulario() {
  const searchParams = useSearchParams();
  const destino = searchParams.get("volver") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const entrar = async () => {
    if (!password || entrando) return;
    setEntrando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Recarga completa para que el middleware vea la cookie nueva.
        window.location.href = destino;
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No ha sido posible entrar");
      setPassword("");
      inputRef.current?.focus();
    } catch {
      setError("Sin conexión. Inténtalo otra vez.");
    }
    setEntrando(false);
  };

  return (
    <Fondo>
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: 340, textAlign: "center" }}
      >
        <motion.p
          initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 16 }}
          style={{ fontSize: 52, margin: 0 }}
        >
          💗
        </motion.p>

        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 400,
          color: "white", margin: "16px 0 6px", letterSpacing: "-0.5px",
        }}>
          R&A
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", margin: "0 0 34px", lineHeight: 1.5 }}>
          Vuestro espacio. Solo vuestro.
        </p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") entrar(); }}
          placeholder="Contraseña"
          autoComplete="current-password"
          style={{
            width: "100%", padding: "15px 18px", borderRadius: 15, boxSizing: "border-box",
            border: `1px solid ${error ? "#FF6B6B" : "rgba(255,255,255,0.16)"}`,
            background: "rgba(255,255,255,0.08)", color: "white",
            fontSize: 16, textAlign: "center", outline: "none",
            letterSpacing: password ? "0.28em" : "normal",
            transition: "border-color 0.2s",
          }}
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: 13, color: "#FF9B9B", margin: "11px 0 0" }}
          >
            {error}
          </motion.p>
        )}

        <button
          onClick={entrar}
          disabled={!password || entrando}
          style={{
            width: "100%", marginTop: 14, padding: "15px", borderRadius: 15, border: "none",
            background: password && !entrando ? "#FF2D55" : "rgba(255,255,255,0.1)",
            color: password && !entrando ? "white" : "rgba(255,255,255,0.4)",
            fontSize: 15.5, fontWeight: 700,
            cursor: password && !entrando ? "pointer" : "default",
            transition: "background 0.2s",
          }}
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>

        <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", margin: "26px 0 0", lineHeight: 1.6 }}>
          Sin esta contraseña no se puede leer nada de la app.
        </p>
      </motion.div>
    </Fondo>
  );
}

function Fondo({ children }: { children?: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(165deg, #1C1C1E 0%, #3A1526 55%, #7A1231 100%)",
      padding: 24,
    }}>
      {children}
    </div>
  );
}
