"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import {
  BCN, TIPO_MOMENTO, colorDeContacto, inicialDe,
  type TipoMomento, type Barrio, type Etapa, type Contacto,
} from "@/lib/barcelona/types";
import { getEtapaActiva, getBarrios, getContactos, addMomento, hoyISO } from "@/lib/barcelona/queries";
import { avisar } from "@/lib/barcelona/avisar";
import { subirMedia as subirAlServidor, fechaDeLaFoto, esVideo } from "@/lib/upload";
import { Media } from "@/components/barcelona/Media";
import { Pantalla, Campo, estiloInput, Boton } from "@/components/barcelona/Shell";

/** Atajos para no teclear. No es una lista cerrada: se puede escribir lo que sea. */
const ATAJOS: TipoMomento[] = [
  "explorar", "restaurante", "visita_piso", "rooftop", "playa", "excursion", "cita", "mudanza",
];

export default function MomentoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);

  const [vivido, setVivido] = useState(searchParams.get("plan") !== "1");
  const [tipo, setTipo] = useState<TipoMomento>("");
  const [contactoId, setContactoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  // El calendario manda el día que se ha pinchado.
  const [fecha, setFecha] = useState(searchParams.get("fecha") ?? hoyISO());
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [esHito, setEsHito] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [falloFoto, setFalloFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dónde estamos: coordenadas para el mapa y barrio para no tener que saberlo
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [ubicando, setUbicando] = useState(false);
  const [avisoUbicacion, setAvisoUbicacion] = useState<string | null>(null);
  /** Cuándo se hizo la foto más antigua que se ha subido. */
  const [cuandoFueron, setCuandoFueron] = useState<Date | null>(null);

  /** ¿Las fotos se hicieron hace un rato largo? */
  const fotosDeOtroMomento = (): boolean => {
    if (!cuandoFueron) return false;
    return Date.now() - cuandoFueron.getTime() > 2 * 60 * 60 * 1000;
  };

  const ubicar = () => {
    if (ubicando) return;

    if (fotosDeOtroMomento()) {
      const cuando = cuandoFueron!.toLocaleString("es-ES", {
        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      });
      const seguir = confirm(
        `Las fotos son del ${cuando}.

` +
        "Si las estáis subiendo desde otro sitio, esto guardará dónde estáis " +
        "ahora, no dónde fue. ¿Seguimos igual?"
      );
      if (!seguir) return;
    }

    if (!navigator.geolocation) {
      setAvisoUbicacion("Este móvil no sabe decirnos dónde está.");
      return;
    }
    setUbicando(true);
    setAvisoUbicacion(null);

    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        setCoords({ lat: c.latitude, lng: c.longitude });
        try {
          const res = await fetch(`/api/barcelona/donde?lat=${c.latitude}&lng=${c.longitude}`);
          const d = await res.json();

          if (d.barrio_id) {
            setBarrioId(d.barrio_id);
            setAvisoUbicacion(`Estáis en ${d.barrio}${d.calle ? `, ${d.calle}` : ""}`);
          } else if (d.sugerido) {
            // Un barrio que no tenéis en la lista: al menos lo dejamos escrito
            setAvisoUbicacion(`Estáis en ${d.sugerido}, que no está entre vuestros barrios.`);
            if (!lugar.trim() && d.calle) setLugar(d.calle);
          } else {
            setAvisoUbicacion("Ubicación guardada, pero no sabemos el barrio.");
          }
          if (!lugar.trim() && d.calle && d.barrio_id) setLugar(d.calle);
        } catch {
          setAvisoUbicacion("Ubicación guardada, pero no hemos podido mirar el barrio.");
        } finally {
          setUbicando(false);
        }
      },
      (error) => {
        setUbicando(false);
        setAvisoUbicacion(
          error.code === error.PERMISSION_DENIED
            ? "Nos falta permiso para saber dónde estáis."
            : "No hemos podido localizaros. Probad al aire libre."
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  };

  /**
   * Situar el momento por el nombre del sitio.
   *
   * Hace falta porque las fotos se suben cuando se suben: unas fotos de
   * Terrassa se pueden estar subiendo desde el tren, y coger la ubicación
   * de ese momento las deja en el sitio equivocado. Más vale escribir
   * dónde fue que adivinarlo.
   */
  const buscarSitio = async () => {
    const texto = lugar.trim();
    if (!texto || ubicando) return;
    setUbicando(true);
    setAvisoUbicacion(null);
    try {
      const res = await fetch(`/api/barcelona/situar?q=${encodeURIComponent(texto)}`);
      const d = await res.json();
      if (d.lat && d.lng) {
        setCoords({ lat: d.lat, lng: d.lng });
        setAvisoUbicacion(`Situado en ${d.nombre ?? texto}${d.zona ? `, ${d.zona}` : ""}`);
      } else {
        setAvisoUbicacion(`No hemos encontrado «${texto}». Probad con el nombre del pueblo o del barrio.`);
      }
    } catch {
      setAvisoUbicacion("No hemos podido buscarlo ahora mismo.");
    } finally {
      setUbicando(false);
    }
  };

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  useEffect(() => {
    getEtapaActiva().then(async (e) => {
      if (!e) return;
      setEtapa(e);
      const [b, c] = await Promise.all([getBarrios(e.id), getContactos(e.id)]);
      setBarrios(b);
      setContactos(c);
    });
  }, []);

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setSubiendo(true);
    setFalloFoto(null);

    const urls: string[] = [];
    let fallidas = 0;
    let motivo: string | null = null;
    let masAntigua: Date | null = null;

    for (const f of files) {
      // La fecha hay que leerla antes de subir: al encogerla se pierde.
      // En los vídeos no la buscamos: va en otro sitio del archivo y con
      // otro formato, y la fecha del momento ya la ponéis vosotros.
      if (!esVideo(f)) {
        const cuando = await fechaDeLaFoto(f);
        if (cuando && (!masAntigua || cuando < masAntigua)) masAntigua = cuando;
      }

      const r = await subirAlServidor(f, "barcelona");
      if (r.url) urls.push(r.url);
      else { fallidas++; motivo = r.error; }
    }

    // Si las fotos son de otro día, la fecha del momento es la de ellas.
    // Es más fiable que la de hoy: nadie sube las fotos en el momento.
    if (masAntigua) {
      setCuandoFueron(masAntigua);
      const suDia = `${masAntigua.getFullYear()}-${String(masAntigua.getMonth() + 1).padStart(2, "0")}-${String(masAntigua.getDate()).padStart(2, "0")}`;
      if (vivido && suDia !== fecha) setFecha(suDia);
    }

    setFotos((prev) => [...prev, ...urls]);

    // Si alguna se queda por el camino, hay que decirlo: antes fallaba en
    // silencio y parecía que la app se había quedado colgada.
    if (fallidas > 0) {
      setFalloFoto(
        fallidas === files.length
          ? (motivo ?? "No hemos podido subir la foto.")
          : `${fallidas} de ${files.length} no han subido. ${motivo ?? ""}`.trim()
      );
    }
    setSubiendo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const guardar = async () => {
    if (!etapa || !titulo.trim()) return;
    setGuardando(true);
    await addMomento(etapa.id, {
      fecha,
      hora: hora || null,
      estado: vivido ? "vivido" : "previsto",
      tipo: tipo.trim() || "otro",
      titulo: titulo.trim(),
      nota: nota.trim() || null,
      fotos,
      lugar: lugar.trim() || null,
      barrio_id: barrioId || null,
      contacto_id: contactoId || null,
      // Con las coordenadas, el momento aparece también en el mapa
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      autor: user,
      es_hito: esHito,
      espontaneo: vivido,
    });

    avisar(user, vivido ? "momento" : "plan", titulo.trim(), hora || lugar.trim());
    router.back();
  };

  return (
    <Pantalla
      titulo={vivido ? "Guardar momento" : "Añadir plan"}
      subtitulo={vivido ? "Capturad esto antes de que se os olvide" : "Algo que queréis hacer"}
      color={vivido ? BCN.teja : BCN.mar}
    >
      {/* Vivido o previsto */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { v: true,  label: "Ya lo hemos vivido", icon: "📸" },
          { v: false, label: "Es un plan",          icon: "🗓️" },
        ].map((o) => (
          <button key={String(o.v)} onClick={() => setVivido(o.v)}
            style={{
              flex: 1, padding: "13px 10px", borderRadius: 14,
              border: `1.5px solid ${vivido === o.v ? (o.v ? BCN.teja : BCN.mar) : BCN.arenaOsc}`,
              background: vivido === o.v ? (o.v ? BCN.teja : BCN.mar) : "white",
              color: vivido === o.v ? "white" : BCN.tinta,
              fontSize: 13.5, fontWeight: vivido === o.v ? 700 : 500, cursor: "pointer",
              transition: "all 0.15s",
            }}>
            <span style={{ fontSize: 17, display: "block", marginBottom: 3 }}>{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>

      <Campo label="¿Qué es?">
        <input
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="Escribid lo que sea: firma, mudanza, cena…"
          style={estiloInput}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {ATAJOS.map((t) => {
            const cfg = TIPO_MOMENTO[t];
            const activo = tipo === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(activo ? "" : t)}
                style={{
                  padding: "6px 11px", borderRadius: 16, cursor: "pointer", fontSize: 12.5,
                  border: `1px solid ${activo ? cfg.color : BCN.arenaOsc}`,
                  background: activo ? `${cfg.color}18` : "white",
                  color: activo ? cfg.color : BCN.humo,
                  fontWeight: activo ? 600 : 500,
                }}
              >
                {cfg.icon} {cfg.label}
              </button>
            );
          })}
        </div>
      </Campo>

      {contactos.length > 0 && (
        <Campo label="¿Con quién?">
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, margin: "0 -20px", paddingLeft: 20, paddingRight: 20 }}>
            {contactos.map((c) => {
              const activo = contactoId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContactoId(activo ? "" : c.id)}
                  style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 5, padding: "8px 6px 6px", borderRadius: 12, cursor: "pointer", width: 66,
                    border: `1.5px solid ${activo ? BCN.tinta : "transparent"}`,
                    background: activo ? BCN.arena : "transparent",
                  }}
                >
                  <span style={{
                    width: 34, height: 34,
                    borderRadius: c.tipo === "empresa" ? 10 : "50%",
                    background: colorDeContacto(c.nombre), color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 600, fontFamily: "Georgia, serif",
                    opacity: activo ? 1 : 0.55,
                  }}>
                    {inicialDe(c.nombre)}
                  </span>
                  <span style={{
                    fontSize: 10.5, color: activo ? BCN.tinta : BCN.humo, textAlign: "center",
                    lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    width: "100%", fontWeight: activo ? 600 : 500,
                  }}>
                    {c.nombre.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </Campo>
      )}

      <Campo label="Título">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
          placeholder={vivido ? "Primer paseo por Gràcia" : "Visita piso en Sant Antoni"}
          style={estiloInput} />
      </Campo>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1.4 }}>
          <Campo label="Fecha">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={estiloInput} />
          </Campo>
        </div>
        <div style={{ flex: 1 }}>
          <Campo label="Hora">
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={estiloInput} />
          </Campo>
        </div>
      </div>

      <Campo label={vivido ? "¿Cómo fue?" : "Detalles"}>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3}
          placeholder={vivido ? "Nos encantó esta zona…" : "Dirección, con quién, qué mirar…"}
          style={{ ...estiloInput, resize: "vertical", lineHeight: 1.5 }} />
      </Campo>

      <Campo label="¿Dónde fue?">
        <input value={lugar} onChange={(e) => { setLugar(e.target.value); setCoords(null); }}
          placeholder="Terrassa, Plaça del Sol, Bar Ramón…" style={estiloInput} />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={ubicar}
            disabled={ubicando}
            style={{
              flex: 1, padding: "11px 10px", borderRadius: 12,
              cursor: ubicando ? "default" : "pointer",
              border: `1.5px solid ${coords ? BCN.oliva : BCN.arenaOsc}`,
              background: coords ? `${BCN.oliva}12` : "white",
              color: coords ? BCN.oliva : BCN.mar,
              fontSize: 13.5, fontWeight: 600,
            }}
          >
            {ubicando ? "🛰️ Buscando…" : coords ? "✓ Situado" : "📍 Estamos aquí"}
          </button>

          <button
            type="button"
            onClick={buscarSitio}
            disabled={!lugar.trim() || ubicando}
            style={{
              flex: 1, padding: "11px 10px", borderRadius: 12,
              cursor: lugar.trim() && !ubicando ? "pointer" : "default",
              border: `1.5px solid ${BCN.arenaOsc}`,
              background: "white",
              color: lugar.trim() ? BCN.mar : BCN.humo,
              fontSize: 13.5, fontWeight: 600,
            }}
          >
            🔎 Fue en…
          </button>
        </div>

        <p style={{ fontSize: 11.5, color: BCN.humo, margin: "7px 0 0", lineHeight: 1.5 }}>
          «Estamos aquí» si lo apuntáis en el sitio. Si lo apuntáis después,
          escribid arriba dónde fue y buscadlo.
        </p>

        {avisoUbicacion && (
          <p style={{
            fontSize: 12.5, lineHeight: 1.5, margin: "7px 0 0",
            color: coords ? BCN.oliva : BCN.humo,
          }}>
            {avisoUbicacion}
          </p>
        )}
      </Campo>

      {barrios.length > 0 && (
        <Campo label="Barrio">
          <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)} style={estiloInput}>
            <option value="">Sin barrio concreto</option>
            {barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>

        </Campo>
      )}

      {/* Fotos y vídeos */}
      <Campo label="Fotos y vídeos">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {fotos.map((url, i) => (
            <motion.div key={url} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: "relative", width: 72, height: 72, borderRadius: 12, overflow: "hidden", border: `1px solid ${BCN.arenaOsc}` }}>
              <Media url={url} style={{ width: "100%", height: "100%" }} />
              <button onClick={() => setFotos(fotos.filter((_, j) => j !== i))} aria-label="Quitar"
                style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "rgba(44,36,32,0.75)", border: "none", color: "white", fontSize: 12, cursor: "pointer", lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </motion.div>
          ))}
          <button onClick={() => fileRef.current?.click()} disabled={subiendo}
            style={{ width: 72, height: 72, borderRadius: 12, border: `1.5px dashed ${BCN.arenaOsc}`, background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: BCN.humo }}>
            {subiendo ? "…" : "+"}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={subirFoto}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />

        <p style={{ fontSize: 11.5, color: BCN.humo, margin: "7px 0 0", lineHeight: 1.5 }}>
          Los vídeos, cortos: hasta 50 MB, que son unos 20 o 30 segundos.
        </p>

        {subiendo && (
          <p style={{ fontSize: 12.5, color: BCN.humo, margin: "8px 0 0" }}>
            Subiendo…
          </p>
        )}
        {falloFoto && !subiendo && (
          <p style={{ fontSize: 12.5, color: BCN.teja, margin: "8px 0 0", lineHeight: 1.5 }}>
            {falloFoto}
          </p>
        )}
      </Campo>

      {/* Hito */}
      <button onClick={() => setEsHito(!esHito)}
        style={{
          width: "100%", marginTop: 4, marginBottom: 8, padding: "13px 15px", borderRadius: 14,
          border: `1.5px solid ${esHito ? BCN.sol : BCN.arenaOsc}`,
          background: esHito ? `${BCN.sol}18` : "white",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 11, textAlign: "left",
        }}>
        <span style={{ fontSize: 19 }}>{esHito ? "⭐" : "☆"}</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: BCN.tinta, margin: 0 }}>Marcar como hito</p>
          <p style={{ fontSize: 12, color: BCN.humo, margin: "2px 0 0" }}>Los momentos que de verdad importan</p>
        </div>
      </button>

      <Boton onClick={guardar} disabled={!titulo.trim() || guardando || !etapa}
        color={vivido ? BCN.teja : BCN.mar}>
        {guardando ? "Guardando…" : vivido ? "Guardar momento" : "Añadir a la agenda"}
      </Boton>
    </Pantalla>
  );
}
