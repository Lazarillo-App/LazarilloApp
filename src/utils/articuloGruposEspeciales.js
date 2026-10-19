// src/utils/articuloGruposEspeciales.js
// Única fuente de verdad para detectar las agrupaciones fijas de Artículos
// (Sin agrupación/Todo, Discontinuados, Promociones, Top 20 — todas filas
// reales de la tabla `agrupaciones`, reconocidas por NOMBRE porque no hay
// columna/flag que las marque). Antes esto estaba duplicado (con pequeñas
// inconsistencias) en SidebarCategorias.jsx, TablaArticulos.jsx,
// ArticulosMain.jsx y ArticuloAccionesMenu.jsx.
const norm = (s) => String(s || '').trim().toLowerCase();

export const esTodoGroup = (g) => {
  const n = norm(g?.nombre);
  return ['todo', 'sin agrupacion', 'sin agrupación', 'sin agrupar', 'sin grupo'].includes(n);
};

export const esDiscontinuadosGroup = (g) => {
  const n = norm(g?.nombre);
  return n === 'discontinuados' || n === 'descontinuados';
};

export const esPromoGroup = (g) => norm(g?.nombre) === 'promociones';

export const esTop20Group = (g) => norm(g?.nombre) === 'top 20';
