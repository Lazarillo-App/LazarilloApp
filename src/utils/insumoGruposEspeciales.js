// src/utils/insumoGruposEspeciales.js
// Única fuente de verdad para detectar las 3 agrupaciones fijas de Insumos
// (Todo/Sin agrupación, Discontinuados, Elaborados — todas filas reales de la
// tabla `agrupaciones`, reconocidas por NOMBRE porque no hay columna/flag que
// las marque) y el criterio canónico de "¿este insumo es elaborado?". Antes
// esto estaba triplicado/septuplicado con pequeñas inconsistencias entre
// InsumosMain.jsx, InsumosSidebar.jsx, InsumosTable.jsx, apiInsumosTodo.js,
// useInsumos.js e InsumoRubroAccionesMenu.jsx.
const norm = (s) => String(s || '').trim().toLowerCase();

export const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return ['todo', 'sin agrupacion', 'sin agrupación', 'sin agrupar', 'sin grupo'].includes(n);
};

export const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

export const esElaboradosGroup = (g) => norm(g?.nombre) === 'elaborados';

export const esTop20Group = (g) => norm(g?.nombre) === 'top 20';

// Criterio canónico, con prioridad: receta real activa > flag individual >
// flag del rubro > nombre del rubro que sugiera "elaborado". `resolveRubroInfo`
// recibe el insumo y devuelve { nombre, es_elaborador } o null (mismo shape
// que `resolveRubroInfo` de InsumosMain.jsx) — se inyecta para no acoplar
// este módulo a los mapas de rubros de cada caller.
export const esInsumoElaborado = (insumo, resolveRubroInfo) => {
  if (insumo?.receta_updated_at != null) return true;
  if (insumo?.es_elaborado === true) return true;
  if (insumo?.es_elaborado === false) return false;
  const info = typeof resolveRubroInfo === 'function' ? resolveRubroInfo(insumo) : null;
  const esElaboradorPorFlag = info?.es_elaborador === true;
  const nombreRubro = info?.nombre || String(insumo?.rubro_nombre || insumo?.rubroNombre || '');
  return esElaboradorPorFlag || norm(nombreRubro).includes('elaborado');
};
