"use client";

import { motion } from "framer-motion";

/* ============================================================
   Lo que ve quien llega sin el enlace.

   Ni formulario ni "contraseña incorrecta": nada que probar y
   nada que deducir. Solo una pared educada.
   ============================================================ */

export default function EntrarPage() {
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(165deg, #1C1C1E 0%, #2A1620 60%, #3A1526 100%)",
      padding: 28,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ textAlign: "center", maxWidth: 300 }}
      >
        <motion.p
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 3.5, repeat: Infinity }}
          style={{ fontSize: 40, margin: 0 }}
        >
          🔒
        </motion.p>

        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 400,
          color: "rgba(255,255,255,0.9)", margin: "20px 0 10px", letterSpacing: "-0.3px",
        }}>
          Espacio privado
        </h1>

        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.65 }}>
          Esta app es de dos personas concretas.
          <br />
          Si eres una de ellas, ya sabes cómo entrar.
        </p>
      </motion.div>
    </div>
  );
}
