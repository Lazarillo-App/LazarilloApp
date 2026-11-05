// Portado de lazarillo_gestion/lib/movil/indicadores.ts (misma lógica).
// Indicadores del Inicio del celu (Diego 28/10/2026): food cost (mercadería / ventas),
// personal (gastos en personal / ventas), mix (los dos) y rentabilidad (resultado / ventas),
// el cambio en puntos contra el mes anterior y el promedio mensual de los meses cerrados.

const suma = (rs, re) => rs.filter((r) => re.test(r.rubro)).reduce((s, r) => s + r.total, 0);

export function indicadores(ventas, rubros) {
  const gastos = rubros.reduce((s, r) => s + r.total, 0);
  const pct = (x) => (ventas > 0 ? x / ventas : null);
  const merc = suma(rubros, /mercader/i);
  const pers = suma(rubros, /personal/i);
  return { ventas, gastos, resultado: ventas - gastos, rentabilidad: pct(ventas - gastos), foodCost: pct(merc), personal: pct(pers), mix: pct(merc + pers) };
}

/** Diferencia en puntos porcentuales (0.023 → 2,3 pp). null si falta alguno. */
export function difPp(actual, anterior) {
  return actual == null || anterior == null ? null : (actual - anterior) * 100;
}

/** Promedio mensual de los meses con ventas, sumando todo (los % salen de los totales). */
export function promedioMensual(meses) {
  const con = meses.filter((m) => m.ventas > 0);
  if (!con.length) return null;
  const rubros = new Map ();
  for (const m of con) for (const r of m.rubros) rubros.set(r.rubro, (rubros.get(r.rubro) ?? 0) + r.total);
  const ventas = con.reduce((s, m) => s + m.ventas, 0);
  const tot = indicadores(ventas, [...rubros].map(([rubro, total]) => ({ rubro, total })));
  return { ...tot, meses: con.length, ventas: tot.ventas / con.length, gastos: tot.gastos / con.length, resultado: tot.resultado / con.length };
}
