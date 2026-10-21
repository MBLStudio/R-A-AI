"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";

// ─── Types ────────────────────────────────────────────────────
type Step = "form" | "loading" | "result" | "rating";

interface PlanForm {
  occasion: string;
  location: string;
  budget: string;
  duration: string;
  mood: string;
  note: string;
}

interface GeneratedPlan {
  title: string;
  description: string;
  steps: string[];
  cost: string;
  duration: string;
  why: string;
}

interface Rating {
  creatividad: number;
  momento: number;
  recuerdo: number;
  originalidad: number;
  romanticismo: number;
}

// ─── Form options ─────────────────────────────────────────────
const OCCASIONS = ["Día tranquilo", "Aniversario", "Sorpresa", "Primera cita", "Después del trabajo", "Fin de semana", "Celebración", "Sin motivo especial"];
const LOCATIONS = ["Barcelona", "En casa", "Escapada cerca", "Palencia", "Viaje espontáneo", "Otro"];
const BUDGETS = ["Sin gastar nada", "Menos de 20€", "20€ – 50€", "50€ – 100€", "Sin límite"];
const DURATIONS = ["1–2 horas", "Tarde entera", "Día completo", "Fin de semana"];
const MOODS = ["Romántico y tranquilo", "Activo y aventurero", "Íntimo en casa", "Cultural", "Gastronómico", "Sorpréndeme"];

// ─── Component ───────────────────────────────────────────────
export default function PlansPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser } = useUserStore();
  const userParam = params.user as UserName;

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<PlanForm>({ occasion: "", location: "", budget: "", duration: "", mood: "", note: "" });
  const [plans, setPlans] = useState<GeneratedPlan[]>([]);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [chosenPlan, setChosenPlan] = useState<GeneratedPlan | null>(null);
  const [rating, setRating] = useState<Rating>({ creatividad: 0, momento: 0, recuerdo: 0, originalidad: 0, romanticismo: 0 });
  const [ratingDone, setRatingDone] = useState(false);

  const currentPlan = plans[currentPlanIndex];
  const isValid = form.occasion && form.location && form.budget && form.duration && form.mood;

  const generatePlans = useCallback(async () => {
    if (!isValid) return;
    setStep("loading");

    const systemPrompt = `Eres la IA de planes de pareja de R&A. Generas exactamente 3 planes creativos y específicos para Alejandro y Rut.
Alejandro: 20 años, emprendedor tech. Le gustan los planes con actividad.
Rut: Psicología, TFG; trabaja en una tienda de gafas con turnos semanales. Calmada, romántica. Le gustan los planes tranquilos y especiales.
Viven los dos en Barcelona, se ven a diario y están buscando piso para vivir juntos.
Aniversario: 30 de marzo.

Devuelve EXACTAMENTE este JSON (array de 3 objetos), sin texto adicional:
[
  {
    "title": "nombre corto del plan",
    "description": "descripción de 1-2 frases evocadora",
    "steps": ["paso 1 concreto", "paso 2", "paso 3"],
    "cost": "coste aproximado en euros",
    "duration": "duración real",
    "why": "por qué le va a gustar a los dos específicamente"
  },
  { ... },
  { ... }
]`;

    const userMessage = `Ocasión: ${form.occasion}
Ubicación: ${form.location}
Presupuesto: ${form.budget}
Duración: ${form.duration}
Mood: ${form.mood}
${form.note ? `Nota extra: ${form.note}` : ""}

Genera 3 planes perfectos y diferentes entre sí: uno más económico/tranquilo, uno intermedio, uno más especial/sorprendente.`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMessage }],
          userId: userParam,
          userName: userParam,
          module: "plans",
          systemOverride: systemPrompt,
        }),
      });

      if (!response.body) throw new Error("No body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
            try { fullText += JSON.parse(line.slice(6)).text ?? ""; } catch {}
          }
        }
      }

      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setPlans(parsed);
        setCurrentPlanIndex(0);
        setStep("result");
      } else throw new Error("Invalid JSON");
    } catch {
      // Fallback plans
      setPlans([
        {
          title: "Cena romántica en casa",
          description: "Una velada íntima cocinando juntos, con velas y vuestra música.",
          steps: ["Comprad en el mercado del barrio lo de una receta nueva", "Cocináis juntos con música de fondo", "Cena a la luz de las velas con una película después"],
          cost: "15–20€",
          duration: "3–4 horas",
          why: "Íntimo para Rut, creativo para Alejandro. Sin salir de casa pero especial."
        },
        {
          title: "Atardecer en los Búnkers del Carmel",
          description: "Subid con algo de picar y ved cómo se enciende Barcelona a vuestros pies.",
          steps: ["Comprad algo de picar y bebida por el camino", "Subid a los Búnkers un rato antes del atardecer", "Bajad a cenar algo sencillo por Gràcia"],
          cost: "15–25€",
          duration: "Tarde entera",
          why: "Tranquilo y romántico para Rut, con su punto de aventura para Alejandro."
        },
        {
          title: "Escapada sorpresa a Sitges",
          description: "Tren de 40 minutos y un día entero de mar, casco antiguo y cena con vistas.",
          steps: ["Rodalies R2 Sud desde Passeig de Gràcia o Sants", "Paseo por el casco antiguo y la iglesia sobre el mar", "Playa o calas tranquilas", "Cena frente al mar y tren de vuelta"],
          cost: "50–70€",
          duration: "Día completo",
          why: "Un día libre de Rut convertido en mini-vacaciones sin coger ni un avión."
        }
      ]);
      setCurrentPlanIndex(0);
      setStep("result");
    }
  }, [form, isValid, userParam]);

  const handleLove = () => {
    setChosenPlan(currentPlan);
    setStep("rating");
  };

  const handleNext = () => {
    if (currentPlanIndex < plans.length - 1) {
      setCurrentPlanIndex(i => i + 1);
    } else {
      setCurrentPlanIndex(0);
    }
  };

  const handleDislike = () => {
    setStep("form");
    setPlans([]);
    setCurrentPlanIndex(0);
  };

  const handleRating = (key: keyof Rating, value: number) => {
    setRating(r => ({ ...r, [key]: value }));
  };

  const submitRating = () => setRatingDone(true);

  const avgRating = Object.values(rating).filter(v => v > 0);
  const avgScore = avgRating.length ? (avgRating.reduce((a, b) => a + b, 0) / avgRating.length).toFixed(1) : "—";

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        paddingTop: `calc(12px + env(safe-area-inset-top))`,
        background: "rgba(242,242,247,0.92)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        flexShrink: 0,
      }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>💑</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>Planes de pareja</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>Alejandro & Rut</p>
        </div>
        {step !== "form" && (
          <button onClick={() => { setStep("form"); setPlans([]); setRatingDone(false); }} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 20, background: "rgba(0,0,0,0.06)", border: "none", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer" }}>
            Nuevo
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", paddingBottom: 32 }}>
        <AnimatePresence mode="wait">

          {/* STEP: FORM */}
          {step === "form" && (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.4px" }}>¿Qué plan hacemos?</p>
              <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 24 }}>Cuéntame un poco y creo el plan perfecto para los dos.</p>

              <FormSection label="¿Qué ocasión es?" options={OCCASIONS} value={form.occasion} onChange={v => setForm(f => ({ ...f, occasion: v }))} />
              <FormSection label="¿Dónde estáis?" options={LOCATIONS} value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} />
              <FormSection label="Presupuesto" options={BUDGETS} value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} />
              <FormSection label="¿Cuánto tiempo tenéis?" options={DURATIONS} value={form.duration} onChange={v => setForm(f => ({ ...f, duration: v }))} />
              <FormSection label="¿Qué mood tenéis?" options={MOODS} value={form.mood} onChange={v => setForm(f => ({ ...f, mood: v }))} />

              {/* Free note */}
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>Algo más que quieras añadir</p>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Ej: Rut está estresada con el TFG, quiero algo relajante..."
                  rows={3}
                  style={{
                    width: "100%", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14,
                    padding: "12px 14px", fontSize: 14, color: "var(--text-primary)", fontFamily: "inherit",
                    resize: "none", outline: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={generatePlans}
                disabled={!isValid}
                style={{
                  width: "100%", padding: "16px",
                  background: isValid ? "linear-gradient(135deg, #FF2D55 0%, #FF6B35 100%)" : "rgba(0,0,0,0.1)",
                  border: "none", borderRadius: 18,
                  color: isValid ? "white" : "var(--text-quaternary)",
                  fontSize: 16, fontWeight: 700, cursor: isValid ? "pointer" : "not-allowed",
                  boxShadow: isValid ? "0 4px 20px rgba(255,45,85,0.35)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                ✨ Crear el plan perfecto
              </motion.button>
            </motion.div>
          )}

          {/* STEP: LOADING */}
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(255,45,85,0.2)", borderTopColor: "#FF2D55" }} />
              <p style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 500 }}>Pensando el plan perfecto...</p>
              <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Conozco bien a los dos 💑</p>
            </motion.div>
          )}

          {/* STEP: RESULT */}
          {step === "result" && currentPlan && (
            <motion.div key={`plan-${currentPlanIndex}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: "spring", stiffness: 280, damping: 24 }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 500 }}>Opción {currentPlanIndex + 1} de {plans.length}</p>
                <div style={{ display: "flex", gap: 4 }}>
                  {plans.map((_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === currentPlanIndex ? "#FF2D55" : "rgba(0,0,0,0.15)" }} />
                  ))}
                </div>
              </div>

              {/* Plan card */}
              <div style={{ background: "white", borderRadius: 24, padding: "24px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", marginBottom: 20 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
                  {currentPlan.title}
                </h2>
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 20 }}>
                  {currentPlan.description}
                </p>

                {/* Meta */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                  <MetaBadge icon="💶" text={currentPlan.cost} />
                  <MetaBadge icon="⏱️" text={currentPlan.duration} />
                </div>

                {/* Steps */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-quaternary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Cómo hacerlo</p>
                  {currentPlan.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #FF2D55, #FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "white" }}>{i + 1}</span>
                      </div>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{step}</p>
                    </div>
                  ))}
                </div>

                {/* Why */}
                <div style={{ background: "rgba(255,45,85,0.06)", borderRadius: 14, padding: "14px 16px", borderLeft: "3px solid #FF2D55" }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#FF2D55", margin: "0 0 4px" }}>Por qué os va a gustar</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{currentPlan.why}</p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleLove}
                  style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #FF2D55 0%, #FF6B35 100%)", border: "none", borderRadius: 18, color: "white", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(255,45,85,0.35)" }}>
                  ❤️ Me encanta este plan
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext}
                  style={{ width: "100%", padding: "14px", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, color: "var(--text-primary)", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                  🔄 Otra opción
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleDislike}
                  style={{ width: "100%", padding: "12px", background: "transparent", border: "none", color: "var(--text-tertiary)", fontSize: 14, cursor: "pointer" }}>
                  No me gusta este tipo de planes
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP: RATING */}
          {step === "rating" && (
            <motion.div key="rating" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!ratingDone ? (
                <>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.4px" }}>¿Qué tal fue?</p>
                  <p style={{ fontSize: 14, color: "var(--text-tertiary)", marginBottom: 24 }}>Puntúa el plan <strong>{chosenPlan?.title}</strong> para que R&A aprenda vuestros gustos.</p>

                  {(Object.keys(rating) as (keyof Rating)[]).map((key) => (
                    <RatingRow key={key} label={RATING_LABELS[key]} value={rating[key]} onChange={v => handleRating(key, v)} />
                  ))}

                  <motion.button whileTap={{ scale: 0.97 }} onClick={submitRating}
                    disabled={Object.values(rating).some(v => v === 0)}
                    style={{
                      width: "100%", padding: "16px", marginTop: 8,
                      background: Object.values(rating).every(v => v > 0) ? "linear-gradient(135deg, #FF2D55 0%, #FF6B35 100%)" : "rgba(0,0,0,0.08)",
                      border: "none", borderRadius: 18,
                      color: Object.values(rating).every(v => v > 0) ? "white" : "var(--text-quaternary)",
                      fontSize: 16, fontWeight: 700, cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}>
                    Guardar valoración
                  </motion.button>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 64 }}>💑</div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.5px" }}>¡Valorado!</p>
                  <p style={{ fontSize: 15, color: "var(--text-tertiary)", maxWidth: 260 }}>Puntuación media: <strong style={{ color: "#FF2D55" }}>{avgScore}/5</strong>. R&A tendrá esto en cuenta para el próximo plan.</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setStep("form"); setPlans([]); setRatingDone(false); setRating({ creatividad: 0, momento: 0, recuerdo: 0, originalidad: 0, romanticismo: 0 }); }}
                    style={{ padding: "14px 32px", background: "linear-gradient(135deg, #FF2D55 0%, #FF6B35 100%)", border: "none", borderRadius: 18, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 8, boxShadow: "0 4px 20px rgba(255,45,85,0.3)" }}>
                    Nuevo plan ✨
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function FormSection({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map(opt => (
          <motion.button key={opt} whileTap={{ scale: 0.95 }} onClick={() => onChange(opt)}
            style={{
              padding: "8px 14px", borderRadius: 20,
              background: value === opt ? "#FF2D55" : "white",
              border: value === opt ? "none" : "1px solid rgba(0,0,0,0.08)",
              color: value === opt ? "white" : "var(--text-secondary)",
              fontSize: 13, fontWeight: value === opt ? 600 : 400,
              cursor: "pointer",
              boxShadow: value === opt ? "0 2px 12px rgba(255,45,85,0.35)" : "0 1px 4px rgba(0,0,0,0.05)",
              transition: "all 0.15s ease",
            }}>
            {opt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function MetaBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(0,0,0,0.04)", borderRadius: 20, padding: "5px 12px" }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{text}</span>
    </div>
  );
}

const RATING_LABELS: Record<keyof Rating, string> = {
  creatividad: "Creatividad del plan",
  momento: "El momento vivido",
  recuerdo: "Quedará en el recuerdo",
  originalidad: "Originalidad",
  romanticismo: "Romanticismo",
};

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>{label}</p>
        {value > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: "#FF2D55" }}>{value}/5</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <motion.button key={n} whileTap={{ scale: 0.85 }} onClick={() => onChange(n)}
            style={{
              flex: 1, height: 44, borderRadius: 12,
              background: n <= value ? "linear-gradient(135deg, #FF2D55, #FF6B35)" : "white",
              border: n <= value ? "none" : "1px solid rgba(0,0,0,0.08)",
              color: n <= value ? "white" : "var(--text-quaternary)",
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              boxShadow: n <= value ? "0 2px 8px rgba(255,45,85,0.3)" : "0 1px 4px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}>
            {n}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
