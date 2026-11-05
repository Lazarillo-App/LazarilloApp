// Portado de lazarillo_gestion/lib/movil/evolucion.ts (misma lógica).
import { indicadores } from "@/gestion/indicadores";

// Evolución de un indicador del celu (Diego 29/10/2026): al tocar una tarjeta del Inicio, los
// últimos N meses hasta el que se mira, con la diferencia contra el mes anterior.
// Food cost / Personal / Mix / Rentabilidad son % (diferencia en puntos); Ventas / Gastos /
// Resultado son plata (diferencia en % contra el mes anterior).

export const INFO_INDICADOR = {
  ventas:       { titulo: "Ventas",       tipo: "plata", mejor: "sube" },
  gastos:       { titulo: "Gastos",       tipo: "plata", mejor: "baja" },
  resultado:    { titulo: "Resultado",    tipo: "plata", mejor: "sube" },
  rentabilidad: { titulo: "Rentabilidad", tipo: "pct",   mejor: "sube" },
  foodCost:     { titulo: "Food cost",    tipo: "pct",   mejor: "baja" },
  personal:     { titulo: "Personal",     tipo: "pct",   mejor: "baja" },
  mix:          { titulo: "Mix",          tipo: "pct",   mejor: "baja" },
};

/** Diferencia contra el anterior: puntos (0.32 vs 0.30 → 2) para %, variación % para plata. */
export function difContra(clave, valor, ant) {
  if (valor == null || ant == null) return null;
  if (INFO_INDICADOR[clave].tipo === "pct") return (valor - ant) * 100;
  return ant === 0 ? null : ((valor - ant) / Math.abs(ant)) * 100;
}

/** "bueno" / "malo" / null (sin cambio) según hacia dónde conviene que vaya el indicador. */
export function sentido(clave, dif) {
  if (dif == null || Math.abs(dif) < 0.05) return null;
  return (dif > 0) === (INFO_INDICADOR[clave].mejor === "sube") ? "bueno" : "malo";
}

export function serieIndicador(p) {
  const t0 = p.hasta.anio * 12 + p.hasta.mes - 1;
  const valorDe = (anio, mes) => {
    if (anio === p.hasta.anio && mes === p.hasta.mes && p.actual) return p.actual.valor;
    const m = p.meses.find((x) => x.anio === anio && x.mes === mes);
    return m && m.ventas > 0 ? indicadores(m.ventas, m.rubros)[p.clave] : null;
  };
  const out = [];
  // Uno más al principio para tener la diferencia del primero.
  for (let k = p.n; k >= 0; k--) {
    const t = t0 - k;
    const anio = Math.floor(t / 12), mes = (t % 12) + 1;
    const valor = valorDe(anio, mes);
    const ant = out.length ? out[out.length - 1].valor : null;
    out.push({ anio, mes, valor, dif: difContra(p.clave, valor, ant), proyectado: k === 0 && !!p.actual?.proyectado });
  }
  return out.slice(1);
}
