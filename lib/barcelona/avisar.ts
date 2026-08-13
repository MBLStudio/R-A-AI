// ============================================================
// R&A — Avisar al otro
//
// Se llama después de guardar algo. Nunca antes, y nunca
// esperando: si el aviso falla, lo guardado sigue guardado.
// Por eso no devuelve nada ni lanza errores.
// ============================================================

export type Aviso =
  | "momento"
  | "plan"
  | "fotos"
  | "valoracion_barrio"
  | "valoracion_piso"
  | "barrio"
  | "gasto"
  | "aportacion"
  | "contacto"
  | "piso";

/**
 * @param de    quién lo ha hecho
 * @param tipo  qué ha pasado
 * @param que   el nombre de la cosa: el barrio, el concepto del gasto…
 * @param extra un detalle más, si viene bien: el importe, la hora…
 */
export function avisar(de: string, tipo: Aviso, que?: string, extra?: string): void {
  // Sin await a propósito: nadie debe esperar a que salga un aviso
  fetch("/api/push/aviso", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ de, tipo, que, extra }),
    keepalive: true,
  }).catch(() => {
    /* si no sale, no pasa nada: lo importante ya está guardado */
  });
}
