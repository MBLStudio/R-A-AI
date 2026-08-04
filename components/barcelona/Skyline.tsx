"use client";

import { BCN } from "@/lib/barcelona/types";

/* ═══════════════════════════════════════════════════════════
   El perfil de Barcelona al atardecer, dibujado a mano.

   De izquierda a derecha: Montjuïc, la ciudad, la Sagrada
   Família, la Torre Agbar y el mar.

   Va como fondo de la cabecera. Si algún día ponéis una foto
   vuestra, se pone encima y esto queda debajo.
   ═══════════════════════════════════════════════════════════ */

export function Skyline({ opacidad = 1 }: { opacidad?: number }) {
  return (
    <svg
      viewBox="0 0 400 150"
      preserveAspectRatio="xMidYMax slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: opacidad }}
      aria-hidden
    >
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={BCN.tejaOsc} />
          <stop offset="42%"  stopColor={BCN.teja} />
          <stop offset="100%" stopColor={BCN.sol} />
        </linearGradient>
        <linearGradient id="lejos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="cerca" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#5A2418" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#5A2418" stopOpacity="0.20" />
        </linearGradient>
      </defs>

      <rect width="400" height="150" fill="url(#cielo)" />

      {/* Sol bajo */}
      <circle cx="318" cy="88" r="19" fill="#FFD98A" opacity="0.30" />
      <circle cx="318" cy="88" r="11" fill="#FFE9B8" opacity="0.42" />

      {/* Collserola al fondo */}
      <path d="M0,104 C34,88 62,96 92,86 C124,76 156,92 190,84 C226,76 262,92 300,86 C338,80 372,92 400,86 L400,150 L0,150 Z"
        fill="url(#lejos)" />

      {/* Ciudad — capa lejana */}
      <g fill="#ffffff" opacity="0.13">
        <rect x="18"  y="104" width="16" height="46" />
        <rect x="40"  y="112" width="12" height="38" />
        <rect x="58"  y="98"  width="14" height="52" />
        <rect x="132" y="108" width="13" height="42" />
        <rect x="150" y="100" width="11" height="50" />
        <rect x="228" y="106" width="15" height="44" />
        <rect x="248" y="112" width="12" height="38" />
        <rect x="350" y="108" width="14" height="42" />
        <rect x="370" y="114" width="12" height="36" />
      </g>

      {/* Montjuïc, a la izquierda */}
      <path d="M0,126 C16,110 34,104 52,110 C68,115 78,124 88,132 L88,150 L0,150 Z"
        fill="#4A2416" opacity="0.30" />
      {/* Castillo */}
      <g fill="#4A2416" opacity="0.42">
        <rect x="30" y="102" width="20" height="9" />
        <rect x="34" y="97"  width="4"  height="5" />
        <rect x="42" y="97"  width="4"  height="5" />
      </g>

      {/* Sagrada Família — las torres */}
      <g fill="#5A2418" opacity="0.46">
        <path d="M172,150 L172,74 Q174,62 176,74 L176,150 Z" />
        <path d="M180,150 L180,64 Q182,50 184,64 L184,150 Z" />
        <path d="M188,150 L188,58 Q190,42 192,58 L192,150 Z" />
        <path d="M196,150 L196,66 Q198,52 200,66 L200,150 Z" />
        <path d="M204,150 L204,78 Q206,66 208,78 L208,150 Z" />
        <rect x="170" y="112" width="40" height="38" />
      </g>

      {/* Torre Agbar */}
      <path d="M268,150 L268,96 Q268,82 274,78 Q280,82 280,96 L280,150 Z"
        fill="#5A2418" opacity="0.42" />

      {/* Ciudad — capa cercana */}
      <g fill="url(#cerca)">
        <rect x="98"  y="120" width="22" height="30" />
        <rect x="124" y="126" width="18" height="24" />
        <rect x="216" y="124" width="20" height="26" />
        <rect x="240" y="130" width="16" height="20" />
        <rect x="290" y="122" width="20" height="28" />
        <rect x="314" y="128" width="18" height="22" />
        <rect x="336" y="124" width="16" height="26" />
      </g>

      {/* El mar */}
      <path d="M300,138 C330,134 360,140 400,136 L400,150 L300,150 Z"
        fill="#1B5E7E" opacity="0.24" />
      <path d="M318,144 Q328,141 338,144 T358,144" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.16" />
      <path d="M344,148 Q354,145 364,148 T384,148" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.12" />
    </svg>
  );
}
