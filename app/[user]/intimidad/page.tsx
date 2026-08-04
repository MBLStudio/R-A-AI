"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { loadMes, loadTotales, addEntrada, deleteEntrada, type IntimidadEntry, type TipoIntimidad, type IntimidadTotales } from "@/lib/intimidad";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES = ["L","M","X","J","V","S","D"];

const TIPOS: { id: TipoIntimidad; emoji: string; label: string; color: string }[] = [
  { id: "follar",       emoji: "❤️", label: "Follamos",        color: "linear-gradient(135deg,#FF2D55,#FF6B8A)" },
  { id: "chupada_ella", emoji: "🩷", label: "Ella me lo chupó", color: "rgba(0,0,0,0.05)" },
  { id: "chupada_el",   emoji: "🩷", label: "Yo le chupé",      color: "rgba(0,0,0,0.05)" },
];

function iconForTipo(tipo: TipoIntimidad): string {
  return tipo === "follar" ? "❤️" : "🩷";
}

export default function IntimidadPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const userParam = params.user as UserName;

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  const today = new Date();
  const [year, setYear]     = useState(today.getFullYear());
  const [month, setMonth]   = useState(today.getMonth());
  const [entries, setEntries] = useState<IntimidadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [totales, setTotales] = useState<IntimidadTotales>({ totalFollar: 0, totalOtros: 0 });
  const [loadingTotales, setLoadingTotales] = useState(true);

  useEffect(() => {
    loadTotales().then((t) => { setTotales(t); setLoadingTotales(false); });
  }, []);

  useEffect(() => {
    setLoading(true);
    loadMes(year, month).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const byDay = entries.reduce<Record<number, IntimidadEntry[]>>((acc, e) => {
    const d = parseInt(e.fecha.split("-")[2]);
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {});

  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstDow     = new Date(year, month, 1).getDay();
  const startOffset  = (firstDow + 6) % 7; // lunes primero
  const totalCells   = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const handleAdd = async (tipo: TipoIntimidad) => {
    if (selectedDay === null || adding) return;
    setAdding(true);
    const fecha = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    const entry = await addEntrada(tipo, fecha);
    if (entry) {
      setEntries((prev) => [...prev, entry]);
      setTotales((prev) => ({
        totalFollar: tipo === "follar" ? prev.totalFollar + 1 : prev.totalFollar,
        totalOtros:  tipo !== "follar" ? prev.totalOtros  + 1 : prev.totalOtros,
      }));
    }
    setAdding(false);
    setSelectedDay(null);
  };

  const handleDelete = async (id: string) => {
    const entry = entries.find((e) => e.id === id);
    await deleteEntrada(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (entry) {
      setTotales((prev) => ({
        totalFollar: entry.tipo === "follar" ? prev.totalFollar - 1 : prev.totalFollar,
        totalOtros:  entry.tipo !== "follar" ? prev.totalOtros  - 1 : prev.totalOtros,
      }));
    }
  };

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const selectedEntries = selectedDay !== null ? (byDay[selectedDay] ?? []) : [];

  // Conteo del mes para el resumen
  const totalFollar  = entries.filter((e) => e.tipo === "follar").length;
  const totalOtros   = entries.filter((e) => e.tipo !== "follar").length;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        style={{
          padding: "14px 20px", paddingTop: `calc(14px + env(safe-area-inset-top))`,
          background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)", flexShrink: 0, zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()}
            style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.3px" }}>Secretos 🔐</h1>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>Solo vosotros lo veis</p>
          </div>
        </div>
      </motion.div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", paddingBottom: "100px" }}>

        {/* Contador histórico */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: "linear-gradient(135deg, #FF2D55 0%, #C1135A 100%)",
            borderRadius: 22, padding: "20px 24px", marginBottom: 12,
            boxShadow: "0 6px 28px rgba(255,45,85,0.28)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>En total</p>
            <motion.p
              key={totales.totalFollar + totales.totalOtros}
              initial={{ scale: 1.2 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              style={{ fontSize: 42, fontWeight: 900, color: "white", margin: 0, letterSpacing: "-2px", lineHeight: 1 }}
            >
              {loadingTotales ? "—" : totales.totalFollar + totales.totalOtros}
            </motion.p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "4px 0 0", fontWeight: 500 }}>
              {loadingTotales ? "cargando..." : totales.totalFollar + totales.totalOtros === 0 ? "añadid el primero" : "momentos juntos"}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "8px 16px", textAlign: "center", backdropFilter: "blur(8px)" }}>
              <motion.p key={totales.totalFollar} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0, lineHeight: 1 }}
              >{loadingTotales ? "—" : totales.totalFollar}</motion.p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: "3px 0 0", fontWeight: 600 }}>❤️ follamos</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "8px 16px", textAlign: "center", backdropFilter: "blur(8px)" }}>
              <motion.p key={totales.totalOtros} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                style={{ fontSize: 22, fontWeight: 800, color: "white", margin: 0, lineHeight: 1 }}
              >{loadingTotales ? "—" : totales.totalOtros}</motion.p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: "3px 0 0", fontWeight: 600 }}>🩷 otros</p>
            </div>
          </div>
        </motion.div>

        {/* Navegación mes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "white", borderRadius: 18, padding: "12px 16px",
            marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          <button onClick={prevMonth} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{MONTHS_ES[month]} {year}</p>
            {!loading && (
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
                {totalFollar > 0 && `❤️ ×${totalFollar}`}{totalFollar > 0 && totalOtros > 0 && "  "}{totalOtros > 0 && `🩷 ×${totalOtros}`}
                {entries.length === 0 && "Sin registros"}
              </p>
            )}
          </div>
          <button onClick={nextMonth} style={{ background: "rgba(0,0,0,0.06)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="#1C1C1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </motion.div>

        {/* Calendario */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{
            background: "white", borderRadius: 22, padding: "16px 10px",
            boxShadow: "0 2px 14px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)",
          }}
        >
          {/* Cabecera días semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {DAYS_ES.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.28)", padding: "4px 0", letterSpacing: "0.04em" }}>{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const day  = i - startOffset + 1;
              const valid = day >= 1 && day <= daysInMonth;
              const dayEntries  = valid ? (byDay[day] ?? []) : [];
              const hasEntries  = dayEntries.length > 0;
              const isCurrentDay = valid && isToday(day);
              const isSelected  = selectedDay === day;

              return (
                <motion.button
                  key={i}
                  whileTap={valid ? { scale: 0.85 } : {}}
                  onClick={() => valid && setSelectedDay(isSelected ? null : day)}
                  style={{
                    aspectRatio: "1", border: "none", borderRadius: 11,
                    cursor: valid ? "pointer" : "default",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                    background: isSelected
                      ? "linear-gradient(135deg,#FF2D55,#FF6B8A)"
                      : isCurrentDay
                        ? "rgba(255,45,85,0.1)"
                        : hasEntries
                          ? "rgba(255,45,85,0.05)"
                          : "transparent",
                    transition: "background 0.12s",
                  }}
                >
                  {valid && (
                    <>
                      <span style={{
                        fontSize: 13,
                        fontWeight: isCurrentDay || hasEntries ? 700 : 400,
                        color: isSelected ? "white" : isCurrentDay ? "#FF2D55" : "var(--text-primary)",
                        lineHeight: 1,
                      }}>{day}</span>
                      {hasEntries && (
                        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                          {dayEntries.slice(0, 2).map((e) => (
                            <span key={e.id} style={{ fontSize: 8, lineHeight: 1 }}>{iconForTipo(e.tipo)}</span>
                          ))}
                          {dayEntries.length > 2 && (
                            <span style={{ fontSize: 7, color: isSelected ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.35)", lineHeight: 1 }}>+{dayEntries.length - 2}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Leyenda */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 14 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 13 }}>❤️</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Follamos</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 13 }}>🩷</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>Otros momentos</span>
          </div>
        </motion.div>
      </div>

      {/* Sheet: día seleccionado */}
      <AnimatePresence>
        {selectedDay !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.38)", zIndex: 50, backdropFilter: "blur(4px)" }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
                background: "white", borderRadius: "24px 24px 0 0",
                padding: "20px 20px", paddingBottom: `calc(28px + env(safe-area-inset-bottom))`,
              }}
            >
              {/* Handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.14)", margin: "0 auto 18px" }} />

              <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
                {selectedDay} de {MONTHS_ES[month]}
              </p>

              {/* Entradas existentes */}
              {selectedEntries.length > 0 && (
                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedEntries.map((e) => {
                    const t = TIPOS.find((t) => t.id === e.tipo)!;
                    return (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.04)", borderRadius: 12, padding: "10px 14px" }}>
                        <span style={{ fontSize: 18 }}>{t.emoji}</span>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{t.label}</span>
                        <button
                          onClick={() => handleDelete(e.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, opacity: 0.35, padding: 4, lineHeight: 1 }}
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>
                Añadir momento
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {TIPOS.map(({ id, emoji, label, color }) => (
                  <motion.button
                    key={id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleAdd(id)}
                    disabled={adding}
                    style={{
                      background: color, border: "none", borderRadius: 16, padding: "15px 20px",
                      display: "flex", alignItems: "center", gap: 14,
                      cursor: adding ? "default" : "pointer",
                      boxShadow: id === "follar" ? "0 4px 16px rgba(255,45,85,0.28)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{adding ? "⏳" : emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: id === "follar" ? "white" : "var(--text-primary)" }}>
                      {label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(242,242,247,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom)", paddingTop: 8, zIndex: 40,
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
