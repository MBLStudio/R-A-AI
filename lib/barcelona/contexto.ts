// ============================================================
// R&A — Proyecto Barcelona · Contexto para la IA
// Convierte el estado de la etapa en texto compacto.
// Lo comparten el resumen del hub, el semanal, la narrativa
// y el copiloto.
// ============================================================

import { supabase } from "../supabase";
import { rankear, calcularCompatibilidad } from "./compat";
import { TIPO_MOMENTO, TIPO_CONTACTO } from "./types";
import type { Etapa, Barrio, Momento, Piso, Valoracion, Contacto } from "./types";
import {
  saldoDelBote, calcularBalance, porCategoria, delMes, categoria, euros,
} from "./gastos";
import type { Gasto, Bote, GastoFijo, FormaPago } from "./gastos";

export interface DatosEtapa {
  etapa: Etapa;
  barrios: Barrio[];
  momentos: Momento[];
  pisos: Piso[];
  valoraciones: Valoracion[];
  contactos: Contacto[];
  gastos: Gasto[];
  botes: Bote[];
  fijos: GastoFijo[];
}

/** Carga todo el estado de una etapa en paralelo (uso servidor). */
export async function cargarDatos(etapaId: string): Promise<DatosEtapa | null> {
  const [etapa, barrios, momentos, pisos, valoraciones, contactos, gastos, botes, fijos] =
    await Promise.all([
      supabase.from("bcn_etapas").select("*").eq("id", etapaId).maybeSingle(),
      supabase.from("bcn_barrios").select("*").eq("etapa_id", etapaId).order("orden"),
      supabase.from("bcn_momentos").select("*").eq("etapa_id", etapaId).order("fecha", { ascending: false }),
      supabase.from("bcn_pisos").select("*").eq("etapa_id", etapaId),
      supabase.from("bcn_valoraciones").select("*").eq("etapa_id", etapaId),
      supabase.from("bcn_contactos").select("*").eq("etapa_id", etapaId),
      supabase.from("bcn_gastos").select("*").eq("etapa_id", etapaId).order("fecha", { ascending: false }),
      supabase.from("bcn_botes").select("*").eq("etapa_id", etapaId).eq("archivado", false).order("orden"),
      supabase.from("bcn_gastos_fijos").select("*").eq("etapa_id", etapaId).order("dia"),
    ]);

  if (!etapa.data) return null;

  return {
    etapa: etapa.data as Etapa,
    barrios: (barrios.data ?? []) as Barrio[],
    momentos: (momentos.data ?? []) as Momento[],
    pisos: (pisos.data ?? []) as Piso[],
    valoraciones: (valoraciones.data ?? []) as Valoracion[],
    contactos: (contactos.data ?? []) as Contacto[],
    gastos: (gastos.data ?? []) as Gasto[],
    botes: (botes.data ?? []) as Bote[],
    fijos: (fijos.data ?? []) as GastoFijo[],
  };
}

export function diasDesde(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((hoy.getTime() - new Date(fecha + "T00:00:00").getTime()) / 86_400_000);
}

/**
 * Estado de la etapa en texto plano.
 * `detalle` controla cuánto se incluye: "resumen" para los textos
 * generados, "completo" para el copiloto (que necesita responder
 * preguntas concretas sobre cualquier cosa).
 */
export function construirContexto(d: DatosEtapa, detalle: "resumen" | "completo" = "resumen"): string {
  const completo = detalle === "completo";
  const hoy = new Date().toISOString().slice(0, 10);
  const dias = diasDesde(d.etapa.fecha_llegada);

  const vividos = d.momentos.filter((m) => m.estado === "vivido");
  const previstos = d.momentos.filter((m) => m.estado === "previsto" && m.fecha >= hoy);

  const p: string[] = [];

  p.push(`FECHA DE HOY: ${hoy}`);
  p.push(
    dias === null
      ? `ETAPA: ${d.etapa.nombre}`
      : dias < 0
      ? `ETAPA: ${d.etapa.nombre}. Todavía no han llegado — faltan ${Math.abs(dias)} días (llegada el ${d.etapa.fecha_llegada}).`
      : `ETAPA: ${d.etapa.nombre}. Llevan ${dias} días en ${d.etapa.ciudad} (llegaron el ${d.etapa.fecha_llegada}).`
  );
  if (d.etapa.fecha_mudanza) p.push(`MUDANZA PREVISTA: ${d.etapa.fecha_mudanza}`);

  // ── Barrios ──
  const valBarrios = d.valoraciones.filter((v) => v.entidad_tipo === "barrio");
  const ranking = rankear(d.barrios, valBarrios).filter((r) => r.compat.porcentaje !== null);

  if (ranking.length > 0) {
    p.push("\nBARRIOS VALORADOS (por compatibilidad R&A):");
    for (const { entidad, compat } of ranking.slice(0, completo ? 20 : 8)) {
      const ejes = compat.ejes
        .filter((e) => e.ale !== null && e.rut !== null)
        .map((e) => `${e.label} A${e.ale}/R${e.rut}`)
        .join(", ");
      p.push(`- ${entidad.nombre}: ${compat.porcentaje}% (${compat.estado}). ${ejes}`);
      if (compat.notaAle) p.push(`  Nota de Alejandro: "${compat.notaAle}"`);
      if (compat.notaRut) p.push(`  Nota de Rut: "${compat.notaRut}"`);
    }
  }

  const sinValorar = d.barrios.filter((b) => !valBarrios.some((v) => v.entidad_id === b.id));
  if (sinValorar.length > 0) {
    p.push(`BARRIOS AÚN SIN VALORAR: ${sinValorar.map((b) => b.nombre).join(", ")}`);
  }

  // ── Historia ──
  if (vividos.length > 0) {
    p.push(`\nMOMENTOS VIVIDOS (${vividos.length} en total, los más recientes primero):`);
    for (const m of vividos.slice(0, completo ? 60 : 20)) {
      const tipo = TIPO_MOMENTO[m.tipo]?.label ?? m.tipo;
      const hito = m.es_hito ? " [HITO]" : "";
      const lugar = m.lugar ? ` en ${m.lugar}` : "";
      const fotos = m.fotos.length > 0 ? ` (${m.fotos.length} foto${m.fotos.length > 1 ? "s" : ""})` : "";
      p.push(`- ${m.fecha} · ${tipo}${hito}: ${m.titulo}${lugar}${fotos}`);
      if (m.nota) p.push(`  "${m.nota}"`);
    }
  } else {
    p.push("\nMOMENTOS VIVIDOS: ninguno todavía.");
  }

  // ── Agenda ──
  if (previstos.length > 0) {
    p.push("\nLO QUE VIENE:");
    for (const m of previstos.slice(0, completo ? 30 : 10)) {
      const tipo = TIPO_MOMENTO[m.tipo]?.label ?? m.tipo;
      p.push(`- ${m.fecha}${m.hora ? ` ${m.hora.slice(0, 5)}` : ""} · ${tipo}: ${m.titulo}${m.lugar ? ` en ${m.lugar}` : ""}`);
    }
  } else {
    p.push("\nLO QUE VIENE: la agenda está vacía.");
  }

  // ── Pisos ──
  if (d.pisos.length > 0) {
    const porEstado = d.pisos.reduce<Record<string, number>>((acc, x) => {
      acc[x.estado] = (acc[x.estado] ?? 0) + 1;
      return acc;
    }, {});
    p.push(`\nPISOS: ${d.pisos.length} guardados (${Object.entries(porEstado).map(([e, n]) => `${n} ${e}`).join(", ")}).`);

    const valPisos = d.valoraciones.filter((v) => v.entidad_tipo === "piso");
    const listar = completo ? d.pisos : d.pisos.filter((x) => x.estado === "favorito" || x.estado === "elegido");
    for (const piso of listar.slice(0, 25)) {
      const c = calcularCompatibilidad(valPisos.filter((v) => v.entidad_id === piso.id));
      const barrio = d.barrios.find((b) => b.id === piso.barrio_id);
      p.push(
        `- ${piso.titulo}${piso.precio ? ` · ${piso.precio}€/mes` : ""}${piso.m2 ? ` · ${piso.m2}m²` : ""}` +
        `${piso.habitaciones ? ` · ${piso.habitaciones}hab` : ""}${barrio ? ` · ${barrio.nombre}` : ""}` +
        ` · ${piso.estado}${c.porcentaje !== null ? ` · compatibilidad ${c.porcentaje}%` : ""}`
      );
      if (completo && piso.motivo_descarte) p.push(`  Descartado porque: ${piso.motivo_descarte}`);
    }
  } else {
    p.push("\nPISOS: todavía no han guardado ninguno.");
  }

  // ── Dinero ──
  //
  // Va justo detrás de los pisos a propósito: la pregunta de verdad
  // no es "¿nos gusta este piso?" sino "¿nos lo podemos permitir con
  // lo que estamos gastando?", y para contestarla hay que tener las
  // dos cosas a la vista.
  //
  // La deuda se da ya calculada y con la advertencia al lado. Es el
  // error clásico al repartir gastos —decir la diferencia entera en
  // vez de la mitad— y así no hay ocasión de cometerlo.
  if (d.gastos.length === 0 && d.botes.length === 0) {
    p.push("\nDINERO: todavía no han apuntado ningún gasto.");
  } else {
    p.push("\nDINERO:");

    for (const b of d.botes) {
      const saldo = saldoDelBote(d.gastos, b.id);
      p.push(`- Bote "${b.nombre}": quedan ${euros(saldo)}${b.objetivo ? ` (el objetivo era ${euros(b.objetivo)})` : ""}.`);
    }

    const mesActual = hoy.slice(0, 7);
    const gastosDelMes = delMes(d.gastos, mesActual);
    const comunes = gastosDelMes.filter((g) => g.tipo === "gasto" && !g.personal);
    const gastadoMes = comunes.reduce((t, g) => t + g.importe, 0);
    p.push(`- Llevan gastados este mes ${euros(gastadoMes)} en ${comunes.length} apuntes (sin contar lo personal de cada uno).`);

    const cats = porCategoria(gastosDelMes);
    if (cats.length > 0) {
      p.push(`  En qué se va: ${cats.slice(0, completo ? 7 : 4).map((c) => `${categoria(c.clave).label} ${euros(c.total)}`).join(" · ")}`);
    }

    const bal = calcularBalance(d.gastos);
    p.push(`- Ha puesto cada uno desde el principio: Alejandro ${euros(bal.total.alejandro)}, Rut ${euros(bal.total.rut)}.`);
    if (bal.quienVaDelante) {
      const delante = bal.quienVaDelante === "alejandro" ? "Alejandro" : "Rut";
      const detras = bal.quienVaDelante === "alejandro" ? "Rut" : "Alejandro";
      p.push(`  ${delante} va por delante. Para quedar en paz, ${detras} le daría ${euros(bal.deuda)} — esa cifra ya es la mitad de la diferencia y es la buena; no digas nunca la diferencia entera.`);
    } else {
      p.push("  Están en paz: nadie le debe nada a nadie.");
    }

    // Solo el que tenga algo: poner "Rut 0,00 €" invita a comentarlo
    const suyo: string[] = [];
    if (bal.personal.alejandro > 0) suyo.push(`Alejandro ${euros(bal.personal.alejandro)}`);
    if (bal.personal.rut > 0) suyo.push(`Rut ${euros(bal.personal.rut)}`);
    if (suyo.length > 0) {
      p.push(`- Sus cosas de cada uno, que no entran en el reparto: ${suyo.join(", ")}.`);
    }

    const activos = d.fijos.filter((f) => f.activo);
    if (activos.length > 0) {
      const suma = activos.reduce((t, f) => t + f.importe, 0);
      p.push(`- Fijos de todos los meses (${euros(suma)} en total): ${activos.map((f) => `${f.concepto} ${euros(f.importe)} el día ${f.dia}`).join(" · ")}`);
    }

    if (completo && d.gastos.length > 0) {
      const dePagador = (f: FormaPago) =>
        f === "bote" ? "del bote" : f === "alejandro" ? "lo puso Alejandro" : "lo puso Rut";
      p.push("  Últimos apuntes:");
      for (const g of d.gastos.slice(0, 30)) {
        const qué = g.tipo === "aportacion" ? "APORTACIÓN al bote" : categoria(g.categoria).label;
        p.push(`  · ${g.fecha} — ${g.concepto}: ${euros(g.importe)} (${qué}, ${dePagador(g.pagado_por)})${g.personal ? " [personal]" : ""}`);
        if (g.nota) p.push(`    "${g.nota}"`);
      }
    }
  }

  // ── Contactos ──
  if (d.contactos.length > 0) {
    if (completo) {
      p.push("\nCONTACTOS:");
      for (const c of d.contactos.slice(0, 30)) {
        const tipo = TIPO_CONTACTO[c.tipo]?.label ?? c.tipo;
        p.push(`- ${c.nombre} (${tipo}${c.empresa ? `, ${c.empresa}` : ""})${c.notas ? ` — ${c.notas}` : ""}`);
      }
    } else {
      p.push(`\nCONTACTOS: ${d.contactos.length} guardados.`);
    }
  }

  return p.join("\n");
}
