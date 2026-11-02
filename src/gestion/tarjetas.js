// Portado de lazarillo_gestion/lib/dashboard/tarjetas.ts (misma lógica).
// Tarjetas del Panel general (rediseño aprobado por Diego, 30/10/2026, mockup_panel_v2c): el
// Panel sirve para mirar el ÚLTIMO MES CERRADO y anticipar el que corre (solo como proyección).
import { indicadores } from "@/gestion/indicadores";
import { equilibrioMes } from "@/gestion/equilibrio";

/**
 * Último mes cerrado del año que se mira: en el año en curso, el anterior al de hoy; en un año
 * pasado, diciembre. Si ese mes no tiene ventas, el último anterior que sí.
 */
export function mesCerrado(meses, anio, hoy) {
  const tope = anio < hoy.anio ? 12 : anio === hoy.anio ? hoy.mes - 1 : 0;
  for (let m = tope; m >= 1; m--) if ((meses.find((x) => x.mes === m)?.ventas ?? 0) > 0) return m;
  return null;
}

export function tarjetasDelMes(meses, mes, variable, anterior) {
  const m = meses.find((x) => x.mes === mes);
  if (!m || !(m.ventas > 0)) return null;
  const i = indicadores(m.ventas, m.rubros);
  const ant = anterior ?? meses.find((x) => x.mes === mes - 1) ?? null;
  const ia = ant && ant.ventas > 0 ? indicadores(ant.ventas, ant.rubros) : null;
  const pp = (a, b) => (a == null || b == null ? null : (a - b) * 100);
  return {
    mes, ventas: i.ventas, gastos: i.gastos, resultado: i.resultado, rentabilidad: i.rentabilidad,
    foodCost: i.foodCost, personal: i.personal, mix: i.mix,
    ventasVsAnterior: ia && ia.ventas > 0 ? i.ventas / ia.ventas - 1 : null,
    difFoodCost: pp(i.foodCost, ia?.foodCost), difPersonal: pp(i.personal, ia?.personal), difMix: pp(i.mix, ia?.mix),
    equilibrio: variable == null ? null : equilibrioMes(i.ventas, i.gastos, variable),
  };
}

/**
 * Alertas de "Para mirar": un indicador del mes cerrado que se fue de lo normal (más de 2 puntos
 * arriba del promedio de los 6 meses anteriores con ventas) y no haber llegado al equilibrio.
 */
export function alertasDelMes(meses, t, anteriores = []) {
  const previos = [...anteriores, ...meses.filter((m) => m.mes < t.mes)].filter((m) => m.ventas > 0).slice(-6);
  const out = [];
  if (t.equilibrio?.equilibrio != null && t.equilibrio.diferencia < 0) out.push({ texto: "No llegó al equilibrio", nivel: "rojo" });
  if (previos.length >= 3) {
    const prom = (k) => {
      const xs = previos.map((m) => indicadores(m.ventas, m.rubros)[k]).filter((v) => v != null);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    for (const [k, nombre] of [["foodCost", "Food cost"], ["personal", "Personal"]]) {
      const p = prom(k), v = t[k];
      if (p != null && v != null && (v - p) * 100 > 2) {
        out.push({ texto: `${nombre} ${(v * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}% · ${((v - p) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} pp arriba de lo normal`, nivel: "ambar" });
      }
    }
  }
  return out;
}
