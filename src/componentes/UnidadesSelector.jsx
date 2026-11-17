// src/componentes/UnidadesSelector.jsx
// Chip del encabezado «Ventas» de la tabla de artículos (Diego 17/11/2026, pendiente #109):
// qué unidades se muestran —Todo (ventas + salidas de stock sin venta), solo Ventas del POS o
// solo Stock (comida de personal, BigBox, publicidad, roturas…)— y, para quien ve facturación,
// pasar a pesos. Cambiar el filtro no vuelve a pedir nada: las salidas ya vienen con las ventas.
import React, { useState } from 'react';
import { Menu, MenuItem, ListItemText, Divider } from '@mui/material';

export const UNIDADES_MODOS = [
  { id: 'todo', chip: 'Todo', nombre: 'Todo', detalle: 'Ventas + salidas de stock sin venta' },
  { id: 'ventas', chip: 'U', nombre: 'Ventas', detalle: 'Lo que se vendió por el POS' },
  { id: 'stock', chip: 'Stock', nombre: 'Stock', detalle: 'Salidas sin venta: personal, BigBox, roturas…' },
];

/** Título de la columna según lo que muestra. */
export function etiquetaVentas(ventasVista, modo) {
  if (ventasVista === '$') return 'Ventas';
  if (modo === 'stock') return 'Salidas';
  if (modo === 'todo') return 'Unidades';
  return 'Ventas';
}

export default function UnidadesSelector({ ventasVista, setVentasVista, modo = 'ventas', onModo, isStaff, color }) {
  const [anchor, setAnchor] = useState(null);
  const actual = UNIDADES_MODOS.find((m) => m.id === modo) || UNIDADES_MODOS[1];
  const chip = ventasVista === '$' ? '$' : actual.chip;
  const elegir = (fn) => { fn(); setAnchor(null); };
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        title={ventasVista === '$' ? 'Mostrando pesos — elegir qué ver' : `Unidades: ${actual.nombre} — elegir qué ver`}
        style={{ padding: '0px 6px', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontWeight: 700, lineHeight: 1.5, fontSize: '0.64rem', flexShrink: 0, background: color, color: '#fff', whiteSpace: 'nowrap' }}
      >
        {chip} ▾
      </button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} transformOrigin={{ vertical: 'top', horizontal: 'center' }}>
        {UNIDADES_MODOS.map((m) => (
          <MenuItem key={m.id} dense selected={ventasVista !== '$' && m.id === modo}
            onClick={() => elegir(() => { setVentasVista('U'); onModo?.(m.id); })}>
            <ListItemText primary={`Unidades · ${m.nombre}`} secondary={m.detalle}
              primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }} secondaryTypographyProps={{ fontSize: '0.7rem' }} />
          </MenuItem>
        ))}
        {!isStaff && <Divider />}
        {!isStaff && (
          <MenuItem dense selected={ventasVista === '$'} onClick={() => elegir(() => setVentasVista('$'))}>
            <ListItemText primary="Pesos ($)" secondary="Lo facturado" primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600 }} secondaryTypographyProps={{ fontSize: '0.7rem' }} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
