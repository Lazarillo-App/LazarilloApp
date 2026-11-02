// src/gestion/resultadosCalc.js
// Colores y mapa de calor del Panel (portado de lazarillo_gestion/lib/dashboard/resultados-calc.ts).

export const RESULT_COLORS = {
  negative: '#D64545',
  neutral: '#AAAA00',
  positive: '#159457',
  noData: '#bdbbb2',
};

// Fondo + texto para el heatmap de Ingresos/Ganancia — los 3 tonos de RESULT_COLORS son
// suficientemente oscuros (luminancia BT.601 < 150) como para llevar siempre texto blanco.
const FILL_BAND = {
  negative: { background: RESULT_COLORS.negative, foreground: '#ffffff' },
  neutral: { background: RESULT_COLORS.neutral, foreground: '#ffffff' },
  positive: { background: RESULT_COLORS.positive, foreground: '#ffffff' },
};

// Cuantiza un ratio 0..1 a 3 bandas discretas en vez de un degradé continuo — "que el cuadro
// se entienda de un vistazo, sin colores de más" (criterio explícito del cliente).
function band(ratio) {
  return ratio < 1 / 3 ? 'negative' : ratio < 2 / 3 ? 'neutral' : 'positive';
}

// Ratio (0..1) para una escala relativa por fila: 0 = mínimo visible, 1 = máximo visible.
// Si min === max (un solo mes visible) no hay forma de ubicar el valor en la escala, así
// que se devuelve el punto medio (ámbar) en vez de forzar un extremo arbitrario.
function linearRatio(value, min, max) {
  return min === max ? 0.5 : (value - min) / (max - min);
}

// Heatmap de relleno para Ingresos: rojo (banda baja) -> ámbar -> verde (banda alta), escala
// relativa por fila — ver linearRatio.
export function heatmapFill(value, min, max) {
  return FILL_BAND[band(linearRatio(value, min, max))];
}

// Celda mensual en modo "% ing" (punto 6 de Pendientes_desarrollo_etapa3 de gestion):
// peso del valor sobre los ingresos de ESE mes. Sin ingresos del mes → "—".
export function computePctCelda(valor, ingresosMes) {
  if (valor == null) return '—';
  if (ingresosMes == null || ingresosMes <= 0) return '—';
  return `${((valor / ingresosMes) * 100).toFixed(1)}%`;
}

// Columna % de cada fila: sobre los ingresos del período o sobre los egresos.
export function computePctLabel(rowTotal, denominator, isLoadingIngresos) {
  if (isLoadingIngresos) return '…';
  return denominator > 0 ? `${((rowTotal / denominator) * 100).toFixed(1)}%` : '—';
}
