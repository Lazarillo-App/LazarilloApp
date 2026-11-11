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

// «Venden poco» (Diego 11/11): los artículos que suman el último 5 % del ingreso
// del período (letra C), solo los que vendieron. No es una fila de `agrupaciones`:
// es una vista virtual con id fijo negativo, calculada en ArticulosMain igual que el Top 20.
export const VENDEN_POCO_ID = -95;
export const grupoVendenPoco = Object.freeze({ id: VENDEN_POCO_ID, nombre: 'Venden poco', articulos: [], _virtual: true });
export const esVendenPocoGroup = (g) => Number(g?.id) === VENDEN_POCO_ID;
// Vistas automáticas por ventas (Top 20 y Venden poco): solo lectura, sin gestión manual.
export const esVistaVentas = (g) => esTop20Group(g) || esVendenPocoGroup(g);
