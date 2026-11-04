// Portado de lazarillo_gestion/lib/dashboard/detalle-periodo.ts (misma lógica).
import { MESES as MONTHS } from "@/gestion/formato";

// Período del modal Detalle de compras (punto 2 de Pendientes_desarrollo_etapa3):
// "Julio 2026" siempre a la vista entre flechas ‹ ›, y toggle Mes / Año /
// Histórico. Puro, separado del componente para testearlo con Vitest.

export function periodoInicial(filter) {
  if (filter.historico) return { modo: "historico", year: filter.year, mes: undefined, meses: undefined };
  if (filter.mes) return { modo: "mes", year: filter.year, mes: filter.mes, meses: undefined };
  return { modo: "anio", year: filter.year, mes: undefined, meses: filter.meses?.length ? filter.meses : undefined };
}

export function cambiarModo(p, modo, hoy = new Date()) {
  if (modo === p.modo) return p;
  switch (modo) {
    case "mes":
      // Del año a un mes: el último mes con sentido (el actual si es ese año, si no diciembre).
      return { modo, year: p.year, mes: p.mes ?? (p.year === hoy.getFullYear() ? hoy.getMonth() + 1 : 12), meses: undefined };
    case "anio":
      return { modo, year: p.year, mes: undefined, meses: undefined };
    case "historico":
      return { modo, year: p.year, mes: undefined, meses: undefined };
  }
}

export function navegar(p, delta) {
  if (p.modo === "historico") return p;
  if (p.modo === "anio") return { ...p, year: p.year + delta, meses: undefined };
  const m = (p.mes ?? 1) + delta;
  if (m < 1) return { ...p, year: p.year - 1, mes: 12 };
  if (m > 12) return { ...p, year: p.year + 1, mes: 1 };
  return { ...p, mes: m };
}

export function labelPeriodo(p) {
  if (p.modo === "historico") return "Histórico";
  if (p.modo === "mes" && p.mes) return `${MES_LARGO[p.mes - 1]} ${p.year}`;
  if (p.meses?.length) return `${p.meses.map((m) => MONTHS[m - 1]).join(", ")} ${p.year}`;
  return String(p.year);
}

const MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Filtro efectivo para la API: el del click, con el período que eligió el usuario encima.
export function aplicarPeriodo(filter, p) {
  return {
    ...filter,
    year: p.year,
    mes: p.modo === "mes" ? p.mes : undefined,
    meses: p.modo === "anio" ? p.meses : undefined,
    historico: p.modo === "historico" ? true : undefined,
  };
}
