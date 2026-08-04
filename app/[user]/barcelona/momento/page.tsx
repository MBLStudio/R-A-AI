"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, TIPO_MOMENTO, type TipoMomento, type Barrio, type Etapa } from "@/lib/barcelona/types";
import { getEtapaActiva, getBarrios, addMomento, hoyISO } from "@/lib/barcelona/queries";
import { uploadPhoto } from "@/lib/upload";
import { Pantalla, Campo, estiloInput, Boton, Selector } from "@/components/barcelona/Shell";

const TIPOS: TipoMomento[] = [
  "explorar", "restaurante", "visita_piso", "rooftop", "playa", "excursion", "cita", "otro",
];

export default function MomentoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [barrios, setBarrios] = useState<Barrio[]>([]);

  const [vivido, setVivido] = useState(searchParams.get("plan") !== "1");
  const [tipo, setTipo] = useState<TipoMomento>("explorar");
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
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  useEffect(() => {
    getEtapaActiva().then(async (e) => {
      if (!e) return;
      setEtapa(e);
      setBarrios(await getBarrios(e.id));
    });
  }, []);

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSubiendo(true);
    const urls: string[] = [];
    for (const f of files) {
      const url = await uploadPhoto(f, "barcelona");
      if (url) urls.push(url);
    }
    setFotos((prev) => [...prev, ...urls]);
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
      tipo,
      titulo: titulo.trim(),
      nota: nota.trim() || null,
      fotos,
      lugar: lugar.trim() || null,
      barrio_id: barrioId || null,
      autor: user,
      es_hito: esHito,
      espontaneo: vivido,
    });
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
        <Selector
          valor={tipo}
          onChange={setTipo}
          color={vivido ? BCN.teja : BCN.mar}
          opciones={TIPOS.map((t) => ({ valor: t, label: TIPO_MOMENTO[t].label, icon: TIPO_MOMENTO[t].icon }))}
        />
      </Campo>

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

      <Campo label="Lugar">
        <input value={lugar} onChange={(e) => setLugar(e.target.value)}
          placeholder="Plaça del Sol, Bar Ramón…" style={estiloInput} />
      </Campo>

      {barrios.length > 0 && (
        <Campo label="Barrio">
          <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)} style={estiloInput}>
            <option value="">Sin barrio concreto</option>
            {barrios.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
      )}

      {/* Fotos */}
      <Campo label="Fotos">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {fotos.map((url, i) => (
            <motion.div key={url} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ position: "relative", width: 72, height: 72, borderRadius: 12, overflow: "hidden", border: `1px solid ${BCN.arenaOsc}` }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => setFotos(fotos.filter((_, j) => j !== i))} aria-label="Quitar foto"
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
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={subirFoto}
          style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />
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
