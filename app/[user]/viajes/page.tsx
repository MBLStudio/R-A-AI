"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChatBubble } from "@/components/ChatBubble";
import { InputBar } from "@/components/InputBar";
import { useUserStore, UserName } from "@/store/userStore";
import { saveConversation, loadConversation, deleteConversation } from "@/lib/memory";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Destination {
  id: string;
  name: string;
  country: string;
  category: string;
  photos: string[];
  budget?: "€" | "€€" | "€€€";
}

const CATEGORIES = ["Todos", "Romántico", "Playa", "Ciudad", "Aventura", "Escapada"];

const U = "https://images.unsplash.com/photo-";
const SU = "https://source.unsplash.com/1200x800/?";
const QS = "?auto=format&fit=crop&w=1200&q=95";

const p = (id: string) => `${U}${id}${QS}`;
const s = (kw: string, sig: number) => `${SU}${kw}&sig=${sig}`;

const DESTINATIONS: Destination[] = [
  { id: "santorini", name: "Santorini",    country: "Grecia",          category: "Romántico", budget: "€€€",
    photos: [p("1533105079780-92b9be482077"), p("1570077188670-e3a8d69ac5ff"), s("santorini,oia,sunset", 3)] },
  { id: "praga",     name: "Praga",        country: "República Checa", category: "Ciudad",    budget: "€",
    photos: [p("1541849546-216549ae216d"), p("1519677100203-a0e668c92439"), s("prague,charles,bridge", 6)] },
  { id: "bali",      name: "Bali",         country: "Indonesia",       category: "Playa",     budget: "€",
    photos: [p("1679250484950-53c332cc4643"), p("1710563142972-e1f1f018346b"), p("1655289112294-02e39768ab6a")] },
  { id: "lisboa",    name: "Lisboa",       country: "Portugal",        category: "Ciudad",    budget: "€",
    photos: [p("1513735492246-483525079686"), p("1555881400-74d7acaacd8b"), s("lisbon,alfama,portugal", 21)] },
  { id: "amsterdam", name: "Amsterdam",    country: "Países Bajos",    category: "Ciudad",    budget: "€€",
    photos: [p("1534351590666-13e3e96b5017"), p("1519922639-96bff4c4cc26"), s("amsterdam,canal,houses", 31)] },
  { id: "amalfi",    name: "Costa Amalfi", country: "Italia",          category: "Romántico", budget: "€€€",
    photos: [p("1548199973-03cce0bbc87b"), p("1621155346337-1d19476ba7d6"), s("amalfi,coast,positano", 41)] },
  { id: "budapest",  name: "Budapest",     country: "Hungría",         category: "Escapada",  budget: "€",
    photos: [p("1506905925346-21bda4d32df4"), p("1570096881776-65fe4c86c700"), s("budapest,parliament,danube", 51)] },
  { id: "islandia",  name: "Islandia",     country: "Islandia",        category: "Aventura",  budget: "€€€",
    photos: [p("1531366936337-7c912a4589a7"), p("1520769945061-0a448c463865"), s("iceland,waterfall,nature", 61)] },
  { id: "tokio",     name: "Tokio",        country: "Japón",           category: "Aventura",  budget: "€€€",
    photos: [p("1599173704727-28abef7425e1"), p("1609747115546-2dc0795407dc"), p("1640871426525-a19540c45a39")] },
  { id: "maldivas",  name: "Maldivas",     country: "Maldivas",        category: "Romántico", budget: "€€€",
    photos: [p("1573843981267-be1999ff37cd"), p("1512100356356-de1b84283e18"), p("1578922746465-3a80a228f223")] },
  { id: "viena",     name: "Viena",        country: "Austria",         category: "Escapada",  budget: "€€",
    photos: [p("1516550893923-42d28e5677af"), s("vienna,palace,schoenbrunn", 92), s("vienna,opera,street", 93)] },
  { id: "nueva-york", name: "Nueva York",  country: "EE.UU.",          category: "Ciudad",    budget: "€€€",
    photos: [p("1496442226666-8d4d0e62e6e9"), p("1534430480872-c1e9e9b88e83"), p("1522083165195-3424ed129620")] },
];

const BUDGETS = ["< 300€", "300–700€", "700–1500€", "+1500€"];

const ACCENT = "#FF2D55";

export default function ViajesPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, userId, setUser } = useUserStore();

  const userParam = params.user as UserName;
  const resolvedUserId = null; // compartido entre Alejandro y Rut

  const [phase, setPhase] = useState<"discovery" | "chat">("discovery");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [customDestInput, setCustomDestInput] = useState("");
  const [customDestinations, setCustomDestinations] = useState<Destination[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalDest, setModalDest] = useState<Destination | null>(null);
  const [modalPhotoIdx, setModalPhotoIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

  const isAlejandro = userParam === "alejandro";

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Cargar historial al montar (resolvedUserId null = compartido)
  useEffect(() => {
    loadConversation(resolvedUserId, "viajes").then((conv) => {
      if (conv && conv.messages.length > 0) {
        setMessages(conv.messages as Message[]);
        conversationIdRef.current = conv.id;
        setPhase("chat");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUserId]);

  const allDestinations = [...DESTINATIONS, ...customDestinations];

  const filteredDestinations =
    activeFilter === "Todos"
      ? allDestinations
      : allDestinations.filter((d) => d.category === activeFilter);

  const toggleDestination = (id: string) => {
    setSelectedDestinations((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const addCustomDestination = () => {
    const trimmed = customDestInput.trim();
    if (!trimmed) return;
    const kw = encodeURIComponent(trimmed);
    const newDest: Destination = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      country: "Destino propio",
      category: "Destino propio",
      photos: [
        `https://source.unsplash.com/featured/800x600/?${kw},travel&sig=1`,
        `https://source.unsplash.com/featured/800x600/?${kw},landscape&sig=2`,
        `https://source.unsplash.com/featured/800x600/?${kw},city&sig=3`,
      ],
    };
    setCustomDestinations((prev) => [...prev, newDest]);
    setCustomDestInput("");
  };

  const openModal = (dest: Destination) => {
    setModalDest(dest);
    setModalPhotoIdx(0);
  };

  const closeModal = () => setModalDest(null);

  const selectedNames = selectedDestinations.map((id) => {
    const dest = allDestinations.find((d) => d.id === id);
    return dest ? dest.name : id;
  });

  const enterChat = async () => {
    const budgetText = budget ? `Presupuesto por persona: ${budget}.` : "Presupuesto abierto por ahora.";
    const firstMsg = `Queremos planificar un viaje a ${selectedNames.join(", ")}. ${budgetText} Somos una pareja y vivimos en Barcelona. Ayúdanos a construir el plan perfecto: vuelos o trenes desde Barcelona, mejor época para ir, alojamiento recomendado, qué ver y hacer, coste real estimado y viabilidad del presupuesto. ¡Empezamos!`;

    const userMessage: Message = { role: "user", content: firstMsg };
    setMessages([userMessage]);
    setPhase("chat");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [userMessage],
          userId: resolvedUserId,
          userName: userParam,
          module: "viajes",
        }),
      });

      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages([userMessage, { role: "assistant", content: "" }]);
      setIsLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
            try {
              const t = JSON.parse(line.slice(6)).text;
              if (t) {
                assistantContent += t;
                setMessages([userMessage, { role: "assistant", content: assistantContent }]);
              }
            } catch {}
          }
        }
      }
      try {
        const finalMessages = [userMessage, { role: "assistant" as const, content: assistantContent }];
        const savedId = await saveConversation(resolvedUserId, "viajes", finalMessages, conversationIdRef.current);
        if (!conversationIdRef.current && savedId) conversationIdRef.current = savedId;
      } catch {}
    } catch {
      setIsLoading(false);
      setMessages([{ role: "assistant", content: "Lo siento, hubo un error. Inténtalo de nuevo." }]);
    }
  };

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;
      const userMessage: Message = { role: "user", content };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            userId: resolvedUserId,
            userName: userParam,
            module: "viajes",
          }),
        });

        if (!response.ok || !response.body) throw new Error();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        setIsLoading(false);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n")) {
            if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
              try {
                const t = JSON.parse(line.slice(6)).text;
                if (t) {
                  assistantContent += t;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                    return updated;
                  });
                }
              } catch {}
            }
          }
        }
        try {
          const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantContent }];
          const savedId = await saveConversation(resolvedUserId, "viajes", finalMessages, conversationIdRef.current);
          if (!conversationIdRef.current && savedId) conversationIdRef.current = savedId;
        } catch {}
      } catch {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Lo siento, hubo un error. Inténtalo de nuevo." },
        ]);
      }
    },
    [isLoading, messages, resolvedUserId, userParam]
  );

  if (phase === "chat") {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-primary)",
          overflow: "hidden",
        }}
      >
        {/* Chat Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            paddingTop: "calc(12px + env(safe-area-inset-top))",
            background: "rgba(242,242,247,0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <button
            onClick={() => setPhase("discovery")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: ACCENT,
              fontSize: 14,
              fontWeight: 600,
              padding: "6px 0",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 12H5M12 5l-7 7 7 7"
                stroke={ACCENT}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Cambiar
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>🌍</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "-apple-system, 'SF Pro Display', sans-serif",
                }}
              >
                Viajes
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                marginTop: 3,
                flexWrap: "nowrap",
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {selectedNames.slice(0, 3).map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: ACCENT,
                    background: "rgba(255,45,85,0.1)",
                    borderRadius: 10,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {name}
                </span>
              ))}
              {selectedNames.length > 3 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-tertiary)",
                    background: "rgba(0,0,0,0.05)",
                    borderRadius: 10,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  +{selectedNames.length - 3}
                </span>
              )}
              {budget && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#007AFF",
                    background: "rgba(0,122,255,0.1)",
                    borderRadius: 10,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {budget}
                </span>
              )}
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={async () => {
                if (conversationIdRef.current) {
                  await deleteConversation(conversationIdRef.current);
                  conversationIdRef.current = undefined;
                }
                setMessages([]);
              }}
              style={{ padding: "6px 12px", borderRadius: 20, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
            >
              Limpiar
            </button>
          )}
        </motion.div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "var(--bg-primary)",
          }}
        >
          {messages.map((msg, i) => (
            <ChatBubble key={i} role={msg.role} content={msg.content} accentColor={ACCENT} />
          ))}
          {isLoading && <ChatBubble role="assistant" content="" isLoading accentColor={ACCENT} />}
          <div ref={messagesEndRef} />
        </div>

        <InputBar
          onSend={sendMessage}
          disabled={isLoading}
          placeholder="Pregunta sobre vuelos, alojamiento, itinerarios..."
          accentColor={ACCENT}
        />
      </div>
    );
  }

  // ─── DISCOVERY PHASE ───────────────────────────────────────────
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-primary)",
        overflow: "hidden",
      }}
    >
      {/* Discovery Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          paddingTop: "calc(12px + env(safe-area-inset-top))",
          background: "rgba(242,242,247,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.06)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M12 5l-7 7 7 7"
              stroke="#1C1C1E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20 }}>🌍</span>
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "-apple-system, 'SF Pro Display', sans-serif",
            }}
          >
            Viajes
          </span>
        </div>

        <span
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            fontWeight: 500,
          }}
        >
          R&A · {isAlejandro ? "Alejandro" : "Rut"}
        </span>
      </motion.div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: "calc(90px + env(safe-area-inset-bottom))",
        }}
      >
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          style={{
            padding: "24px 20px 20px",
            background: "linear-gradient(160deg, #fff0f3 0%, #fff5f0 60%, #f5f0ff 100%)",
            borderBottom: "1px solid rgba(255,45,85,0.08)",
          }}
        >
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "0 0 6px",
              letterSpacing: "-0.5px",
              fontFamily: "-apple-system, 'SF Pro Display', sans-serif",
            }}
          >
            ¿A dónde vais?
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-tertiary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Elige destinos, presupuesto y planificad juntos
          </p>
        </motion.div>

        {/* Category filter pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{
            display: "flex",
            gap: 8,
            padding: "16px 16px 8px",
            overflowX: "auto",
            scrollbarWidth: "none",
            flexShrink: 0,
          }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: 20,
                border: activeFilter === cat ? "none" : "1px solid rgba(0,0,0,0.1)",
                background: activeFilter === cat ? ACCENT : "white",
                color: activeFilter === cat ? "white" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow:
                  activeFilter === cat
                    ? "0 2px 10px rgba(255,45,85,0.3)"
                    : "0 1px 4px rgba(0,0,0,0.06)",
                transition: "all 0.2s ease",
              }}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Destinations grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: "12px 16px 0",
          }}
        >
          <AnimatePresence mode="popLayout">
            {filteredDestinations.map((dest, i) => {
              const isSelected = selectedDestinations.includes(dest.id);
              return (
                <motion.button
                  key={dest.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 24,
                    delay: i * 0.04,
                  }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => openModal(dest)}
                  style={{
                    position: "relative",
                    height: 160,
                    borderRadius: 16,
                    border: isSelected ? `2px solid ${ACCENT}` : "2px solid transparent",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#e0e0e0",
                    boxShadow: isSelected
                      ? `0 4px 20px rgba(255,45,85,0.35)`
                      : "0 2px 12px rgba(0,0,0,0.1)",
                    padding: 0,
                    textAlign: "left",
                    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                  }}
                >
                  {/* Background image */}
                  {dest.photos[0] && (
                    <img
                      src={dest.photos[0]}
                      alt={dest.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  )}

                  {/* Gradient overlay */}
                  {dest.photos[0] && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)",
                      }}
                    />
                  )}

                  {/* Selected checkmark */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: ACCENT,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          boxShadow: "0 2px 8px rgba(255,45,85,0.4)",
                          zIndex: 2,
                        }}
                      >
                        ✓
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Text content */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: "10px 12px",
                      zIndex: 1,
                    }}
                  >
                    {/* Category pill */}
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "white",
                        background: "rgba(255,255,255,0.2)",
                        borderRadius: 8,
                        padding: "2px 7px",
                        marginBottom: 5,
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                    >
                      {dest.category}
                    </span>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: "white",
                        lineHeight: 1.2,
                        letterSpacing: "-0.2px",
                        textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      {dest.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 500, textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
                        {dest.country}
                      </p>
                      {dest.budget && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: dest.budget === "€" ? "#34C759" : dest.budget === "€€" ? "#FF9500" : "#FF3B30",
                          background: dest.budget === "€" ? "rgba(52,199,89,0.2)" : dest.budget === "€€" ? "rgba(255,149,0,0.2)" : "rgba(255,59,48,0.2)",
                          borderRadius: 6, padding: "1px 5px",
                          backdropFilter: "blur(4px)",
                        }}>
                          {dest.budget}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Add custom destination */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            margin: "16px 16px 0",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            value={customDestInput}
            onChange={(e) => setCustomDestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustomDestination();
            }}
            placeholder="Añadir destino propio..."
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "white",
              padding: "0 14px",
              fontSize: 14,
              color: "var(--text-primary)",
              outline: "none",
              fontFamily: "inherit",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          />
          <button
            onClick={addCustomDestination}
            disabled={!customDestInput.trim()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: customDestInput.trim() ? ACCENT : "rgba(0,0,0,0.08)",
              border: "none",
              cursor: customDestInput.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              color: customDestInput.trim() ? "white" : "var(--text-tertiary)",
              fontWeight: 400,
              transition: "background 0.2s ease",
              flexShrink: 0,
              boxShadow: customDestInput.trim() ? "0 2px 10px rgba(255,45,85,0.3)" : "none",
            }}
          >
            +
          </button>
        </motion.div>

        {/* Budget selector */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ padding: "24px 16px 0" }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              margin: "0 0 12px",
            }}
          >
            Presupuesto por persona
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BUDGETS.map((b) => (
              <button
                key={b}
                onClick={() => setBudget(budget === b ? "" : b)}
                style={{
                  padding: "9px 18px",
                  borderRadius: 22,
                  border: budget === b ? "none" : "1px solid rgba(0,0,0,0.1)",
                  background: budget === b ? ACCENT : "white",
                  color: budget === b ? "white" : "var(--text-secondary)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow:
                    budget === b
                      ? "0 3px 12px rgba(255,45,85,0.3)"
                      : "0 1px 4px rgba(0,0,0,0.06)",
                  transition: "all 0.2s ease",
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Spacer */}
        <div style={{ height: 20 }} />
      </div>

      {/* Sticky bottom bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          background: "rgba(242,242,247,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color:
                selectedDestinations.length > 0 ? "var(--text-primary)" : "var(--text-tertiary)",
              fontWeight: selectedDestinations.length > 0 ? 600 : 400,
            }}
          >
            {selectedDestinations.length > 0
              ? `${selectedDestinations.length} destino${selectedDestinations.length > 1 ? "s" : ""} seleccionado${selectedDestinations.length > 1 ? "s" : ""}`
              : "Elige al menos un destino"}
          </p>
          {budget && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: ACCENT,
                background: "rgba(255,45,85,0.1)",
                borderRadius: 10,
                padding: "3px 9px",
              }}
            >
              {budget}
            </span>
          )}
        </div>
        <motion.button
          whileTap={selectedDestinations.length > 0 ? { scale: 0.97 } : {}}
          onClick={selectedDestinations.length > 0 ? enterChat : undefined}
          disabled={selectedDestinations.length === 0}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: "none",
            background:
              selectedDestinations.length > 0
                ? `linear-gradient(135deg, ${ACCENT} 0%, #FF6B35 100%)`
                : "rgba(0,0,0,0.1)",
            color: selectedDestinations.length > 0 ? "white" : "var(--text-tertiary)",
            fontSize: 16,
            fontWeight: 700,
            cursor: selectedDestinations.length > 0 ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow:
              selectedDestinations.length > 0
                ? "0 4px 20px rgba(255,45,85,0.35)"
                : "none",
            transition: "all 0.25s ease",
            letterSpacing: "-0.2px",
          }}
        >
          Planificar con IA
          {selectedDestinations.length > 0 && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </motion.button>
      </div>

      {/* ── DESTINATION MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {modalDest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              position: "fixed", inset: 0, zIndex: 500,
              background: "rgba(0,0,0,0.88)",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "flex-end",
            }}
            onClick={closeModal}
          >
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 520,
                background: "#1A1A1A",
                borderRadius: "28px 28px 0 0",
                overflow: "hidden",
                paddingBottom: `calc(24px + env(safe-area-inset-bottom))`,
              }}
            >
              {/* Photo area with swipe */}
              <div style={{ position: "relative", width: "100%", height: 320, background: "#111", overflow: "hidden" }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={modalPhotoIdx}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.25 }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -50 && modalPhotoIdx < modalDest.photos.length - 1) setModalPhotoIdx(i => i + 1);
                      if (info.offset.x > 50 && modalPhotoIdx > 0) setModalPhotoIdx(i => i - 1);
                    }}
                    style={{ width: "100%", height: "100%", cursor: "grab" }}
                  >
                    <img
                      src={modalDest.photos[modalPhotoIdx]}
                      alt={modalDest.name}
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
                      style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Gradient overlay */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,26,26,0.9) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)", pointerEvents: "none" }} />

                {/* X button */}
                <button
                  onClick={closeModal}
                  style={{
                    position: "absolute", top: 16, right: 16,
                    width: 34, height: 34, borderRadius: "50%",
                    background: "rgba(0,0,0,0.5)", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", backdropFilter: "blur(8px)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </button>

                {/* Photo counter */}
                <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px" }}>
                  <span style={{ fontSize: 12, color: "white", fontWeight: 600 }}>{modalPhotoIdx + 1} / {modalDest.photos.length}</span>
                </div>

                {/* Dot indicators */}
                <div style={{ position: "absolute", bottom: 70, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                  {modalDest.photos.map((_, i) => (
                    <motion.button
                      key={i}
                      onClick={() => setModalPhotoIdx(i)}
                      animate={{ width: i === modalPhotoIdx ? 20 : 6, opacity: i === modalPhotoIdx ? 1 : 0.45 }}
                      style={{ height: 6, borderRadius: 3, background: "white", border: "none", cursor: "pointer", padding: 0 }}
                    />
                  ))}
                </div>

                {/* Destination name overlay */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px" }}>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>{modalDest.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{modalDest.country} · {modalDest.category}</p>
                    {modalDest.budget && (
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: modalDest.budget === "€" ? "#34C759" : modalDest.budget === "€€" ? "#FF9500" : "#FF3B30",
                        background: modalDest.budget === "€" ? "rgba(52,199,89,0.2)" : modalDest.budget === "€€" ? "rgba(255,149,0,0.2)" : "rgba(255,59,48,0.2)",
                        borderRadius: 8, padding: "2px 8px",
                        backdropFilter: "blur(4px)",
                      }}>
                        {modalDest.budget}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow nav */}
              <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "16px 20px 4px" }}>
                {[{ dir: -1, label: "←" }, { dir: 1, label: "→" }].map(({ dir, label }) => (
                  <button
                    key={dir}
                    onClick={() => setModalPhotoIdx(i => Math.max(0, Math.min(modalDest.photos.length - 1, i + dir)))}
                    style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white", fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Select button */}
              <div style={{ padding: "12px 20px 0" }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { toggleDestination(modalDest.id); closeModal(); }}
                  style={{
                    width: "100%", height: 54, borderRadius: 18,
                    border: selectedDestinations.includes(modalDest.id) ? "1px solid rgba(255,255,255,0.15)" : "none",
                    background: selectedDestinations.includes(modalDest.id)
                      ? "rgba(255,255,255,0.1)"
                      : `linear-gradient(135deg, ${ACCENT} 0%, #FF6B35 100%)`,
                    color: "white", fontSize: 16, fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: selectedDestinations.includes(modalDest.id) ? "none" : "0 4px 20px rgba(255,45,85,0.4)",
                  }}
                >
                  {selectedDestinations.includes(modalDest.id) ? "✓ Seleccionado — quitar" : "Seleccionar destino"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
