"use client";

import { useRouter, usePathname } from "next/navigation";
import { useUserStore } from "@/store/userStore";

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeUser } = useUserStore();

  if (!activeUser) return null;

  const items: NavItem[] = [
    { icon: "⊞", label: "Inicio", href: `/${activeUser}` },
    { icon: "👤", label: "Perfil", href: `/${activeUser}/profile` },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingTop: 8,
        paddingLeft: 16,
        paddingRight: 16,
        zIndex: 100,
      }}
    >
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "8px 20px",
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: isActive ? 1 : 0.45,
              transition: "opacity 150ms ease",
            }}
          >
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: "white",
                letterSpacing: "0.02em",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
