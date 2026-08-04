"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { BCN } from "@/lib/barcelona/types";
import { colorCompat } from "@/lib/barcelona/compat";

/* ═══════════════════════════════════════════════════════════
   Mapa real (Leaflet + CARTO Positron, sin API key).

   Se carga siempre con dynamic({ ssr: false }): Leaflet toca
   `window` al importarse y revienta en el render de servidor.

   Los iconos son divIcon con HTML propio — así evitamos el
   clásico problema de los marcadores rotos de Leaflet con
   bundlers, y de paso podemos usar emojis.
   ═══════════════════════════════════════════════════════════ */

export interface PuntoMapa {
  id: string;
  lat: number;
  lng: number;
  icon: string;
  color: string;
  titulo: string;
  detalle: string;
}

export interface BarrioMapa {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  color: string;
  compatibilidad: number | null;
  descripcion: string | null;
}

const CENTRO: [number, number] = [41.3915, 2.1650];

function icono(emoji: string, color: string) {
  return divIcon({
    className: "",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:#fff;border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-size:15px;box-shadow:0 2px 7px rgba(44,36,32,.28);
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

export default function MapaReal({
  barrios, puntos, mostrarBarrios,
}: {
  barrios: BarrioMapa[];
  puntos: PuntoMapa[];
  mostrarBarrios: boolean;
}) {
  const iconos = useMemo(
    () => new Map(puntos.map((p) => [p.id, icono(p.icon, p.color)])),
    [puntos]
  );

  return (
    <MapContainer
      center={CENTRO}
      zoom={13}
      scrollWheelZoom
      style={{ width: "100%", height: "100%", background: BCN.arena }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={19}
      />

      {mostrarBarrios && barrios.map((b) => {
        const sinValorar = b.compatibilidad === null;
        const color = sinValorar ? BCN.humo : (b.color || BCN.teja);
        return (
          <Circle
            key={b.id}
            center={[b.lat, b.lng]}
            radius={sinValorar ? 340 : 340 + (b.compatibilidad! / 100) * 380}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: sinValorar ? 0.1 : 0.22,
              weight: sinValorar ? 1 : 2,
              dashArray: sinValorar ? "4 4" : undefined,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <span style={{ fontFamily: "Georgia, serif", fontSize: 13 }}>
                {b.nombre}
                {!sinValorar && (
                  <strong style={{ color: colorCompat(b.compatibilidad) }}> · {b.compatibilidad}%</strong>
                )}
              </span>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 170 }}>
                <p style={{ fontFamily: "Georgia, serif", fontSize: 16, margin: "0 0 4px", color: BCN.tinta }}>
                  {b.nombre}
                </p>
                {!sinValorar && (
                  <p style={{ fontSize: 13, fontWeight: 700, color: colorCompat(b.compatibilidad), margin: "0 0 5px" }}>
                    Compatibilidad {b.compatibilidad}%
                  </p>
                )}
                {b.descripcion && (
                  <p style={{ fontSize: 12.5, color: BCN.humo, margin: 0, lineHeight: 1.45 }}>{b.descripcion}</p>
                )}
                {sinValorar && (
                  <p style={{ fontSize: 12, color: BCN.humo, margin: "5px 0 0", fontStyle: "italic" }}>
                    Todavía sin valorar
                  </p>
                )}
              </div>
            </Popup>
          </Circle>
        );
      })}

      {puntos.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={iconos.get(p.id)!}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 15, margin: "0 0 3px", color: BCN.tinta }}>
                {p.titulo}
              </p>
              <p style={{ fontSize: 12.5, color: BCN.humo, margin: 0, lineHeight: 1.45 }}>{p.detalle}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
