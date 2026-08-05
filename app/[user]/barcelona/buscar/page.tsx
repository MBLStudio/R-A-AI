"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN } from "@/lib/barcelona/types";
import {
  PORTALES, leerCriterios, guardarCriterios,
  type Criterios,
} from "@/lib/barcelona/portales";
import { Pantalla, Campo, estiloInput } from "@/components/barcelona/Shell";

/* ═══════════════════════════════════════════════════════════
   Buscar.

   Ponéis vuestros filtros una vez y se quedan puestos. A
   partir de ahí, cada portal es un toque y se abre con la
   búsqueda ya hecha y ordenada por lo más reciente.
   ═══════════════════════════════════════════════════════════ */

export default function BuscarPage() {
  const params = useParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [criterios, setCriterios] = useState<Criterios | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);
  useEffect(() => { setCriterios(leerCriterios()); }, []);

  const cambiar = (parcial: Partial<Criterios>) => {
    setCriterios((antes) => {
      if (!antes) return antes;
      const nuevo = { ...antes, ...parcial };
      guardarCriterios(nuevo);
      return nuevo;
    });
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 1600);
  };

  if (!criterios) {
    return (
      <Pantalla titulo="Buscar" color={BCN.mar}>
        <p style={{ textAlign: "center", color: BCN.humo, fontSize: 14, padding: "40px 0" }}>
          Un momento…
        </p>
      </Pantalla>
    );
  }

  return (
    <Pantalla
      titulo="Buscar"
      subtitulo={`Hasta ${criterios.precioMax.toLocaleString("es-ES")} € · ${
        criterios.habitaciones ? `${criterios.habitaciones}+ hab` : "cualquier tamaño"
      }`}
      color={BCN.mar}
    >
      {/* ── Vuestros filtros ─────────────────────────────── */}
      <div style={{
        background: "white", borderRadius: 16, padding: "18px 16px 6px",
        border: `1px solid ${BCN.arenaOsc}`, marginBottom: 22,
      }}>
        <Campo label={`Precio máximo · ${criterios.precioMax.toLocaleString("es-ES")} € al mes`}>
          <input
            type="range" min={400} max={2500} step={50}
            value={criterios.precioMax}
            onChange={(e) => cambiar({ precioMax: Number(e.target.value) })}
            style={{ width: "100%", accentColor: BCN.mar, height: 28 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: BCN.humo, marginTop: -4 }}>
            <span>400 €</span><span>2.500 €</span>
          </div>
        </Campo>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Campo label="Habitaciones">
              <select
                value={criterios.habitaciones}
                onChange={(e) => cambiar({ habitaciones: Number(e.target.value) })}
                style={estiloInput}
              >
                <option value={0}>Las que sean</option>
                <option value={1}>1 o más</option>
                <option value={2}>2 o más</option>
                <option value={3}>3 o más</option>
              </select>
            </Campo>
          </div>
          <div style={{ flex: 1 }}>
            <Campo label="Metros mínimos">
              <select
                value={criterios.m2Min}
                onChange={(e) => cambiar({ m2Min: Number(e.target.value) })}
                style={estiloInput}
              >
                <option value={0}>Sin mínimo</option>
                <option value={40}>40 m²</option>
                <option value={60}>60 m²</option>
                <option value={80}>80 m²</option>
              </select>
            </Campo>
          </div>
        </div>

        <Campo label="Que tenga">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip activo={criterios.ascensor} onClick={() => cambiar({ ascensor: !criterios.ascensor })}>
              Ascensor
            </Chip>
            <Chip activo={criterios.terraza} onClick={() => cambiar({ terraza: !criterios.terraza })}>
              Terraza
            </Chip>
            <Chip activo={criterios.mascotas} onClick={() => cambiar({ mascotas: !criterios.mascotas })}>
              Admite mascotas
            </Chip>
          </div>
        </Campo>

        <p style={{
          fontSize: 11.5, color: guardado ? BCN.oliva : BCN.humo,
          textAlign: "center", margin: "2px 0 12px", transition: "color .3s",
        }}>
          {guardado ? "Guardado" : "Se guardan solos en este móvil"}
        </p>
      </div>

      {/* ── Los portales ─────────────────────────────────── */}
      <p style={{
        fontSize: 11, fontWeight: 700, color: BCN.humo, textTransform: "uppercase",
        letterSpacing: "0.09em", marginBottom: 10,
      }}>
        Abrir la búsqueda ya hecha
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        {PORTALES.map((portal, i) => (
          <motion.a
            key={portal.id}
            href={portal.url(criterios)}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.035, duration: 0.28 }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "14px 13px", borderRadius: 13,
              background: "white", border: `1px solid ${BCN.arenaOsc}`,
              textDecoration: "none", color: BCN.tinta,
              fontSize: 14, fontWeight: 600,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: portal.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {portal.nombre}
            </span>
            <span style={{ color: BCN.humo, fontSize: 13 }}>↗</span>
          </motion.a>
        ))}
      </div>

      <p style={{
        fontSize: 12.5, color: BCN.humo, lineHeight: 1.6,
        textAlign: "center", margin: "22px 0 0",
      }}>
        Cuando veáis algo que os guste, copiad el enlace y pegadlo
        en <strong style={{ color: BCN.teja }}>Vivienda → Añadir un piso</strong>.
      </p>
    </Pantalla>
  );
}

function Chip({ activo, onClick, children }: {
  activo: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "9px 14px", borderRadius: 11, cursor: "pointer",
        border: `1.5px ${activo ? "solid" : "dashed"} ${activo ? BCN.mar : BCN.arenaOsc}`,
        background: activo ? `${BCN.mar}15` : "transparent",
        color: activo ? BCN.mar : BCN.humo,
        fontSize: 13.5, fontWeight: activo ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}
