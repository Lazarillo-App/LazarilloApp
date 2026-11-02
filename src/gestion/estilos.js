// src/gestion/estilos.js
// Estilos compartidos de las tablas del Panel (equivalentes a las clases de lazarillo_gestion).

// "bg-muted" de gestion
export const MUTED = 'grey.100';

// 1ª columna fija a la izquierda, con la línea divisoria (shadow-[1px_0_0_0_hsl(var(--border))]).
export const sxStickyNombre = (bg = 'background.paper') => ({
  position: 'sticky', left: 0, zIndex: 1, bgcolor: bg,
  boxShadow: (t) => `1px 0 0 0 ${t.palette.divider}`,
});

// Celdas numéricas: a la derecha, cifras tabulares, sin cortar.
export const sxNum = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
