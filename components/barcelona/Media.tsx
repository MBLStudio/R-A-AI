"use client";

import { urlEsVideo } from "@/lib/upload";
import { BCN } from "@/lib/barcelona/types";

/* ═══════════════════════════════════════════════════════════
   Una foto o un vídeo, según toque.

   En el álbum, en la historia y en el momento se guarda todo
   en la misma lista, así que lo que hay detrás de una URL solo
   se sabe mirando la extensión. Pintar un vídeo con <img> deja
   un hueco roto, y eso pasaría en cada sitio donde se pinten
   fotos si cada uno se acordara por su cuenta.

   Del vídeo se pide solo la ficha, no el archivo: el navegador
   trae el primer fotograma y nada más. Así una pantalla con
   diez recuerdos no se descarga diez vídeos para enseñar diez
   cuadraditos.
   ═══════════════════════════════════════════════════════════ */

export function Media({ url, onClick, style, play = true }: {
  url: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  /** El triángulo encima. Se quita si el sitio ya deja claro que es un vídeo. */
  play?: boolean;
}) {
  const comun: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover", display: "block",
    ...style,
  };

  if (!urlEsVideo(url)) {
    return <img src={url} alt="" onClick={onClick} style={{ ...comun, cursor: onClick ? "zoom-in" : undefined }} />;
  }

  return (
    <div onClick={onClick} style={{ position: "relative", cursor: onClick ? "pointer" : undefined, ...style }}>
      <video
        src={url}
        preload="metadata"
        muted
        playsInline
        style={{ ...comun, background: BCN.noche }}
      />
      {play && (
        <span style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "white", fontSize: 20, pointerEvents: "none",
          textShadow: "0 1px 7px rgba(0,0,0,0.65)",
        }}>
          ▶
        </span>
      )}
    </div>
  );
}
