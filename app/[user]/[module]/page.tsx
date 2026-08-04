"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChatBubble } from "@/components/ChatBubble";
import { InputBar } from "@/components/InputBar";
import { useUserStore, UserName } from "@/store/userStore";
import { saveConversation, loadConversation, deleteConversation } from "@/lib/memory";
import { uploadPhoto } from "@/lib/upload";

interface Message {
  role: "user" | "assistant";
  content: string;
  image_url?: string;
}

const SHARED_MODULES = ["plans", "viajes"];

const MODULE_TITLES: Record<string, { title: string; icon: string }> = {
  comidas: { title: "Comidas", icon: "🥗" },
  prompts: { title: "Prompts", icon: "✍️" },
  automatizaciones: { title: "Automatizaciones", icon: "⚙️" },
  proyectos: { title: "Proyectos", icon: "🚀" },
  tfg: { title: "TFG Psicología", icon: "🎓" },
  plans: { title: "Planes de pareja", icon: "💑" },
  viajes: { title: "Viajes", icon: "🌍" },
};

export default function ModulePage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, userId, setUser } = useUserStore();

  const userParam = params.user as UserName;
  const moduleParam = params.module as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const moduleInfo = MODULE_TITLES[moduleParam] ?? { title: moduleParam, icon: "💬" };
  const isAlejandro = userParam === "alejandro";
  const accentColor = isAlejandro ? "#1C1C1E" : "#FF2D55";
  const isSharedModule = SHARED_MODULES.includes(moduleParam);
  const isUUID = (id: string | null) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(id);
  // Para módulos compartidos: null. Para personales: solo UUID válido, nunca el nombre string.
  const effectiveUserId: string | null = isSharedModule ? null : (isUUID(userId ?? null) ? userId! : null);

  useEffect(() => {
    if (userParam && userParam !== activeUser) setUser(userParam, userParam);
  }, [userParam, activeUser, setUser]);

  useEffect(() => {
    const loadHistory = async () => {
      // Para personales esperamos el UUID real; para compartidos cargamos siempre
      if (!isSharedModule && !effectiveUserId) return;
      try {
        const conv = await loadConversation(effectiveUserId, moduleParam);
        if (conv && conv.messages.length > 0) {
          setMessages(conv.messages as Message[]);
          setConversationId(conv.id);
        }
      } catch {}
    };
    loadHistory();
  }, [effectiveUserId, moduleParam, isSharedModule]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (content: string, imageFile?: File) => {
    if (isLoading) return;

    // Upload image if provided, get URL for storage + base64 for Claude
    let imageUrl: string | undefined;
    let imageBase64: string | undefined;
    let imageMediaType: string | undefined;
    if (imageFile) {
      // Upload to storage for persistent display
      imageUrl = await uploadPhoto(imageFile, "chat") ?? undefined;
      // Convert to base64 for Claude vision
      imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(imageFile);
      });
      imageMediaType = imageFile.type;
    }

    const userMessage: Message = { role: "user", content, ...(imageUrl ? { image_url: imageUrl } : {}) };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          userId: effectiveUserId,
          userName: userParam,
          module: moduleParam,
          ...(imageBase64 ? { imageBase64, imageMediaType } : {}),
        }),
      });

      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
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
                setMessages(prev => {
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
        const savedId = await saveConversation(effectiveUserId, moduleParam, [...updatedMessages, { role: "assistant", content: assistantContent }], conversationId);
        if (!conversationId && savedId) setConversationId(savedId);
      } catch {}
    } catch {
      setIsLoading(false);
      setMessages(prev => [...prev, { role: "assistant", content: "Lo siento, hubo un error. Inténtalo de nuevo." }]);
    }
  }, [isLoading, messages, userParam, moduleParam, conversationId, effectiveUserId]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px",
          paddingTop: `calc(12px + env(safe-area-inset-top))`,
          background: "rgba(242,242,247,0.92)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          flexShrink: 0, zIndex: 10,
        }}
      >
        <button onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5l-7 7 7 7" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{moduleInfo.icon}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", fontFamily: "-apple-system, 'SF Pro Display', sans-serif" }}>{moduleInfo.title}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
            {isSharedModule ? "Alejandro & Rut · Compartido" : `R&A · ${isAlejandro ? "Alejandro" : "Rut"}`}
          </p>
        </div>

        {messages.length > 0 && (
          <button onClick={async () => {
              if (conversationId) await deleteConversation(conversationId);
              setMessages([]);
              setConversationId(undefined);
            }}
            style={{ padding: "6px 12px", borderRadius: 20, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.06)", color: "var(--text-tertiary)", fontSize: 12, cursor: "pointer" }}>
            Limpiar
          </button>
        )}
      </motion.div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4, background: "var(--bg-primary)" }}>

        {messages.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 40 }}
          >
            <div style={{ width: 72, height: 72, borderRadius: 22, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
              {moduleInfo.icon}
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, textAlign: "center" }}>{moduleInfo.title}</p>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0, textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>¿En qué te ayudo hoy?</p>
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role} content={msg.content} imageUrl={msg.image_url} accentColor={accentColor} />
        ))}

        {isLoading && <ChatBubble role="assistant" content="" isLoading accentColor={accentColor} />}
        <div ref={messagesEndRef} />
      </div>

      <InputBar onSend={sendMessage} disabled={isLoading} placeholder="Escribe a R&A..." accentColor={accentColor} />
    </div>
  );
}
