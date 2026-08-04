// ============================================================
// R&A — Motor de Compatibilidad
// No compara. Entiende.
//
// Sirve a barrios, pisos y experiencias con la misma lógica:
// un % que mezcla cuánto os gusta con cuánto coincidís, y una
// lectura honesta de dónde estáis de acuerdo y dónde no.
// ============================================================

import { EJES, type EjeKey, type Usuario, type Valoracion, BCN } from "./types";

export type EstadoCompat = "consenso" | "matiz" | "divergencia" | "incompleto";

export interface EjeCompat {
  key: EjeKey;
  label: string;
  icon: string;
  ale: number | null;
  rut: number | null;
  /** Distancia entre ambos en ese eje (0-9). */
  gap: number | null;
}

export interface Compatibilidad {
  /** 0-100. null si falta la valoración de alguno de los dos. */
  porcentaje: number | null;
  estado: EstadoCompat;
  ejes: EjeCompat[];
  mediaAle: number | null;
  mediaRut: number | null;
  /** Media de las distancias por eje. Cuanto más bajo, más de acuerdo. */
  gapMedio: number | null;
  /** En qué coincidís más y en qué menos. */
  masAlineado: EjeCompat | null;
  masDividido: EjeCompat | null;
  /** Quién falta por valorar. */
  faltan: Usuario[];
  notaAle: string | null;
  notaRut: string | null;
}

/**
 * Peso del entusiasmo frente al acuerdo.
 * 0.8 → lo que más manda es si os gusta; el acuerdo matiza.
 * Un sitio que os encanta a los dos sube; uno que gusta a medias baja
 * aunque coincidáis en que es mediocre.
 */
const PESO_ENTUSIASMO = 0.8;
const PESO_ACUERDO = 1 - PESO_ENTUSIASMO;

/** Umbrales de lectura, en puntos de diferencia media sobre 10. */
const UMBRAL_CONSENSO = 1.0;
const UMBRAL_MATIZ = 2.5;

const media = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null);

/**
 * Calcula la compatibilidad a partir de las valoraciones de una entidad.
 * Acepta 0, 1 o 2 valoraciones — con menos de 2 devuelve estado "incompleto"
 * pero conserva la media de quien sí valoró.
 */
export function calcularCompatibilidad(valoraciones: Valoracion[]): Compatibilidad {
  const vAle = valoraciones.find((v) => v.usuario === "alejandro") ?? null;
  const vRut = valoraciones.find((v) => v.usuario === "rut") ?? null;

  const ejes: EjeCompat[] = EJES.map((e) => {
    const ale = vAle?.[e.key] ?? null;
    const rut = vRut?.[e.key] ?? null;
    return {
      key: e.key,
      label: e.label,
      icon: e.icon,
      ale,
      rut,
      gap: ale !== null && rut !== null ? Math.abs(ale - rut) : null,
    };
  });

  const notasAle = ejes.map((e) => e.ale).filter((n): n is number => n !== null);
  const notasRut = ejes.map((e) => e.rut).filter((n): n is number => n !== null);
  const mediaAle = media(notasAle);
  const mediaRut = media(notasRut);

  const faltan: Usuario[] = [];
  if (!vAle || notasAle.length === 0) faltan.push("alejandro");
  if (!vRut || notasRut.length === 0) faltan.push("rut");

  // Solo los ejes que ambos han puntuado entran en el cálculo
  const comunes = ejes.filter((e) => e.ale !== null && e.rut !== null);

  if (comunes.length === 0) {
    return {
      porcentaje: null,
      estado: "incompleto",
      ejes,
      mediaAle,
      mediaRut,
      gapMedio: null,
      masAlineado: null,
      masDividido: null,
      faltan,
      notaAle: vAle?.nota ?? null,
      notaRut: vRut?.nota ?? null,
    };
  }

  const suma = comunes.reduce((acc, e) => acc + e.ale! + e.rut!, 0);
  const entusiasmo = suma / (comunes.length * 2 * 10); // 0..1

  const gapMedio = comunes.reduce((acc, e) => acc + e.gap!, 0) / comunes.length; // 0..9
  const acuerdo = 1 - gapMedio / 9; // 0..1

  const porcentaje = Math.round((entusiasmo * PESO_ENTUSIASMO + acuerdo * PESO_ACUERDO) * 100);

  const ordenados = [...comunes].sort((a, b) => a.gap! - b.gap!);

  const estado: EstadoCompat =
    gapMedio <= UMBRAL_CONSENSO ? "consenso" : gapMedio <= UMBRAL_MATIZ ? "matiz" : "divergencia";

  return {
    porcentaje,
    estado,
    ejes,
    mediaAle,
    mediaRut,
    gapMedio: Math.round(gapMedio * 10) / 10,
    masAlineado: ordenados[0] ?? null,
    masDividido: ordenados[ordenados.length - 1] ?? null,
    faltan,
    notaAle: vAle?.nota ?? null,
    notaRut: vRut?.nota ?? null,
  };
}

/** Cómo se lee cada estado en pantalla. */
export const LECTURA: Record<EstadoCompat, { titulo: string; icon: string; color: string }> = {
  consenso:    { titulo: "Consenso claro",        icon: "❤️", color: BCN.teja },
  matiz:       { titulo: "De acuerdo, con matiz", icon: "🙂", color: BCN.oliva },
  divergencia: { titulo: "Lo veis distinto",      icon: "🤔", color: BCN.mar },
  incompleto:  { titulo: "Falta valorar",         icon: "○",  color: BCN.humo },
};

/** Frase corta y honesta para acompañar al %, sin necesidad de llamar a la IA. */
export function fraseCompat(c: Compatibilidad, nombre: string): string {
  if (c.estado === "incompleto") {
    if (c.faltan.length === 2) return `Nadie ha valorado ${nombre} todavía.`;
    const quien = c.faltan[0] === "alejandro" ? "Alejandro" : "Rut";
    return `Falta la valoración de ${quien} para saber cómo encaja.`;
  }

  const alineado = c.masAlineado ? c.masAlineado.label.toLowerCase() : "";
  const dividido = c.masDividido ? c.masDividido.label.toLowerCase() : "";

  if (c.estado === "consenso") {
    return `Coincidís en prácticamente todo, y sobre todo en ${alineado}.`;
  }
  if (c.estado === "matiz") {
    return `Estáis de acuerdo en ${alineado}, aunque veis distinto el ${dividido}.`;
  }

  const quienMas =
    (c.mediaAle ?? 0) > (c.mediaRut ?? 0) ? "Alejandro" : "Rut";
  const quienMenos = quienMas === "Alejandro" ? "Rut" : "Alejandro";
  return `${quienMas} lo valora más que ${quienMenos}. La mayor diferencia está en ${dividido}.`;
}

/** Agrupa un listado plano de valoraciones por entidad. */
export function agruparPorEntidad(valoraciones: Valoracion[]): Map<string, Valoracion[]> {
  const mapa = new Map<string, Valoracion[]>();
  for (const v of valoraciones) {
    const lista = mapa.get(v.entidad_id);
    if (lista) lista.push(v);
    else mapa.set(v.entidad_id, [v]);
  }
  return mapa;
}

/**
 * Ordena entidades por compatibilidad de mayor a menor.
 * Las que aún no tienen las dos valoraciones caen al final.
 */
export function rankear<T extends { id: string }>(
  entidades: T[],
  valoraciones: Valoracion[]
): { entidad: T; compat: Compatibilidad }[] {
  const porEntidad = agruparPorEntidad(valoraciones);
  return entidades
    .map((entidad) => ({
      entidad,
      compat: calcularCompatibilidad(porEntidad.get(entidad.id) ?? []),
    }))
    .sort((a, b) => (b.compat.porcentaje ?? -1) - (a.compat.porcentaje ?? -1));
}

/** Color del % según lo alto que sea — del gris al terracota encendido. */
export function colorCompat(porcentaje: number | null): string {
  if (porcentaje === null) return BCN.humo;
  if (porcentaje >= 85) return BCN.teja;
  if (porcentaje >= 70) return BCN.sol;
  if (porcentaje >= 55) return BCN.oliva;
  return BCN.marClaro;
}
