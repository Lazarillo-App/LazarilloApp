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

// Tabla del Panel. El CSS global (theme-layout.css: `thead th`) pinta los encabezados con el color
// del negocio, redondeados y con !important; acá el encabezado es el gris de gestion (bg-muted).
// Va con más especificidad que el global para poder pisarlo.
export const sxTablaPanel = (t) => ({
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& td, & th': { borderBottomColor: t.palette.divider },
  '& thead th': {
    background: `${t.palette.grey[100]} !important`,
    color: t.palette.text.secondary,
    boxShadow: 'none',
    borderRadius: 0,
    whiteSpace: 'nowrap',
    wordBreak: 'normal',
  },
  // La 1ª columna del encabezado conserva su línea divisoria.
  '& thead th:first-of-type': { boxShadow: `1px 0 0 0 ${t.palette.divider} !important` },
});

// Celda con detalle al hacer click.
export const sxClic = { cursor: 'pointer', '&:hover': { color: 'primary.main' } };

// Botones de la barra de filtros del Panel (BOTON de dashboard-filters.tsx).
export const sxBotonBarra = {
  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', height: 32, px: 1.5, display: 'inline-flex', alignItems: 'center', gap: 0.75,
  borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', fontSize: 14, color: 'text.primary', flexShrink: 0,
  '&:hover': { borderColor: 'grey.400' },
};
