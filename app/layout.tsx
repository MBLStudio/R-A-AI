import type { Metadata, Viewport } from "next";
import { Outfit, Dancing_Script, Parisienne } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

// Caligrafía para la carta de la Sorpresa
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-script",
  display: "swap",
});

// Script elegante para títulos y firma
const parisienne = Parisienne({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-script-elegant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "R&A — Your Personal AI",
  description: "La IA personal de Rut y Alejandro",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "R&A",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F2F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} ${dancingScript.variable} ${parisienne.variable}`}>
      <body style={{ fontFamily: "var(--font-outfit), -apple-system, sans-serif" }}>
        <main style={{ height: "100dvh", overflow: "hidden", position: "relative" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
