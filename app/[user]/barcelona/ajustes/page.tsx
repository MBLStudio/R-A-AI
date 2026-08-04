"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUserStore, UserName } from "@/store/userStore";
import { BCN, type Etapa } from "@/lib/barcelona/types";
import { getEtapaActiva, updateEtapa } from "@/lib/barcelona/queries";
import { Pantalla, Campo, estiloInput, Boton, Tarjeta } from "@/components/barcelona/Shell";

export default function AjustesPage() {
  const params = useParams();
  const router = useRouter();
  const { activeUser, setUser } = useUserStore();
  const user = params.user as UserName;

  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [nombre, setNombre] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [llegada, setLlegada] = useState("");
  const [mudanza, setMudanza] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => { if (user && user !== activeUser) setUser(user, user); }, [user, activeUser, setUser]);

  useEffect(() => {
    getEtapaActiva().then((e) => {
      if (!e) return;
      setEtapa(e);
      setNombre(e.nombre);
      setSubtitulo(e.subtitulo ?? "");
      setLlegada(e.fecha_llegada ?? "");
      setMudanza(e.fecha_mudanza ?? "");
    });
  }, []);

  const guardar = async () => {
    if (!etapa) return;
    setGuardando(true);
    await updateEtapa(etapa.id, {
      nombre: nombre.trim() || etapa.nombre,
      subtitulo: subtitulo.trim() || null,
      fecha_llegada: llegada || null,
      fecha_mudanza: mudanza || null,
    });
    setGuardando(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2200);
  };

  return (
    <Pantalla titulo="Ajustes" subtitulo="Vuestra etapa" color={BCN.humo}>
      {!etapa ? (
        <p style={{ color: BCN.humo, fontSize: 14, textAlign: "center", padding: "40px 0" }}>Cargando…</p>
      ) : (
        <>
          <Campo label="Nombre de la etapa">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} style={estiloInput} />
          </Campo>

          <Campo label="Subtítulo">
            <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Catalanes por una temporada" style={estiloInput} />
          </Campo>

          <Campo label="Fecha de llegada">
            <input type="date" value={llegada} onChange={(e) => setLlegada(e.target.value)} style={estiloInput} />
          </Campo>

          <Campo label="Mudanza prevista">
            <input type="date" value={mudanza} onChange={(e) => setMudanza(e.target.value)} style={estiloInput} />
          </Campo>

          <Boton onClick={guardar} disabled={guardando} color={guardado ? BCN.oliva : BCN.tinta}>
            {guardando ? "Guardando…" : guardado ? "✓ Guardado" : "Guardar cambios"}
          </Boton>

          <div style={{ marginTop: 26 }}>
            <p style={{ fontSize: 10.5, fontWeight: 800, color: BCN.humo, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>
              Otras piezas
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Tarjeta onClick={() => router.push(`/${user}/barcelona/resumen-semanal`)}>
                <p style={{ fontSize: 15, fontWeight: 600, color: BCN.tinta, margin: 0 }}>📊 Resumen semanal</p>
                <p style={{ fontSize: 12.5, color: BCN.humo, margin: "3px 0 0" }}>
                  Cómo ha ido la semana, escrito por vuestro copiloto
                </p>
              </Tarjeta>

              <Tarjeta onClick={() => router.push(`/${user}/barcelona/nuestra-barcelona`)}>
                <p style={{ fontSize: 15, fontWeight: 600, color: BCN.tinta, margin: 0 }}>📖 Nuestra Barcelona</p>
                <p style={{ fontSize: 12.5, color: BCN.humo, margin: "3px 0 0" }}>
                  El relato completo de esta etapa
                </p>
              </Tarjeta>
            </div>
          </div>

          <p style={{ fontSize: 12, color: BCN.humo, textAlign: "center", marginTop: 26, lineHeight: 1.6 }}>
            Estas fechas alimentan el contador de días y todo lo que escribe la IA.
          </p>
        </>
      )}
    </Pantalla>
  );
}
