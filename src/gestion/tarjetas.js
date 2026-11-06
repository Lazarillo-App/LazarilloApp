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

// Personal a medio cargar (Diego 06/11/2026, Comercio oct-26: el Mix no puede bajar porque faltan
// sueldos): si el gasto en personal del mes es menos del UMBRAL del último mes completo, se usa el
// importe de ese mes. Afecta Mix, Personal, Resultado y Equilibrio del mes, marcado como estimado.
const UMBRAL_PERSONAL = 0.8;
const esPersonal = (r) => /personal/i.test(r.rubro);
const totalPersonal = (m) => m.rubros.filter(esPersonal).reduce((s, r) => s + r.total, 0);
/** Meses en orden; devuelve los mismos con el personal completado donde está a medio cargar. */
export function conPersonalCompleto(lista) {
  let ref = null;
  return lista.map((m) => {
    if (!m || !(m.ventas > 0)) return m;
    const p = totalPersonal(m);
    if (ref != null && p < UMBRAL_PERSONAL * ref) {
      const nombre = m.rubros.find(esPersonal)?.rubro ?? "Gastos en personal";
      return { ...m, rubros: [...m.rubros.filter((r) => !esPersonal(r)), { rubro: nombre, total: ref }], personalEstimado: { cargado: p, usado: ref } };
    }
    if (p > 0) ref = p;
    return m;
  });
}

export function tarjetasDelMes(mesesCrudos, mes, variable, anteriorCrudo) {
  const lista = conPersonalCompleto([...(anteriorCrudo ? [anteriorCrudo] : []), ...mesesCrudos.filter((x) => x.mes <= mes).sort((a, b) => a.mes - b.mes)]);
  const anterior = anteriorCrudo ? lista[0] : undefined;
  const meses = anteriorCrudo ? lista.slice(1) : lista;
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
    personalEstimado: m.personalEstimado ?? null,
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
