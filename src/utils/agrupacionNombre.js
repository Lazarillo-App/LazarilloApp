// src/utils/agrupacionNombre.js
// Cómo se MUESTRA el nombre de una agrupación en las listas (Menú e Insumos).
// Solo cambia lo que se ve: el nombre guardado no se toca, porque otras
// partes (KPI de food cost, carta) buscan las agrupaciones por su nombre.
//   - Las que vienen por defecto, en Tipo Título y siempre con el mismo texto.
//   - Las creadas por el negocio, en MAYÚSCULAS (también las que se creen).
const norm = (s) => String(s ?? '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const DE_SISTEMA = {
  'top 20': 'Top 20',
  'todo': 'Sin agrupación',
  'sin agrupacion': 'Sin agrupación',
  'sin agrupar': 'Sin agrupación',
  'sin grupo': 'Sin agrupación',
  'promociones': 'Promociones',
  'elaborados': 'Elaborados',
  'discontinuados': 'Discontinuados',
  'descontinuados': 'Discontinuados',
};

export function nombreAgrupacionVisible(nombreOGrupo) {
  const crudo = typeof nombreOGrupo === 'object' && nombreOGrupo !== null
    ? (nombreOGrupo.name ?? nombreOGrupo.nombre ?? '')
    : nombreOGrupo;
  const texto = String(crudo ?? '').trim();
  return DE_SISTEMA[norm(texto)] ?? texto.toLocaleUpperCase('es-AR');
}

// Formato de cada fila de la lista. Mismo en Menú e Insumos.
//   Top 20: negrita + cursiva. Sin agrupación / Promociones / Elaborados:
//   cursiva. Discontinuados: cursiva en gris. El resto, normal.
export function estiloAgrupacion({ top20 = false, sistema = false, discontinuados = false } = {}) {
  if (top20) return { fontStyle: 'italic', fontWeight: 700 };
  if (discontinuados) return { fontStyle: 'italic', color: '#777' };
  if (sistema) return { fontStyle: 'italic' };
  return {};
}
