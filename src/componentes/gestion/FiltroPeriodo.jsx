// src/componentes/gestion/FiltroPeriodo.jsx
// Botón "📅 2026 · Todo el año" con su popover (dashboard-filters.tsx de gestion): año con
// flechas (acotado al rango con datos) y los 12 meses para marcar; "Todo el año" limpia.
// Tablero #5 (17/11/2026): un clic = ese mes solo; Ctrl/⌘ + clic suma o saca un mes, Shift + clic suma
// el tramo desde el último elegido. En celular (sin teclado) el interruptor «Varios meses» hace de Ctrl.

import React, { useRef, useState } from 'react';
import { Box, Popover, IconButton, Switch, useMediaQuery } from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { MESES } from '@/gestion/formato';
import { sxBotonBarra } from '@/gestion/estilos';

// Etiqueta de los meses elegidos (etiquetaMeses de gestion): "Todo el año", "Mar", "Mar–May",
// "Ene, Mar, Jul" o "5 meses". `meses` viene ordenado.
function etiquetaMeses(meses) {
  if (meses.length === 0 || meses.length === 12) return 'Todo el año';
  if (meses.length === 1) return MESES[meses[0] - 1];
  const seguidos = meses.every((m, i) => i === 0 || m === meses[i - 1] + 1);
  if (seguidos) return `${MESES[meses[0] - 1]}–${MESES[meses[meses.length - 1] - 1]}`;
  if (meses.length <= 3) return meses.map((m) => MESES[m - 1]).join(', ');
  return `${meses.length} meses`;
}

/** Meses que quedan elegidos (pura). modo: 'solo' | 'sumar' | 'tramo'; ancla = último mes tocado. */
// eslint-disable-next-line react-refresh/only-export-components -- pura, se testea aparte
export function mesesTrasClic(meses, m, modo, ancla) {
  let out;
  if (modo === 'tramo' && ancla) {
    const [a, b] = ancla < m ? [ancla, m] : [m, ancla];
    out = [...new Set([...meses, ...Array.from({ length: b - a + 1 }, (_, i) => a + i)])];
  } else if (modo === 'sumar') {
    out = meses.includes(m) ? meses.filter((x) => x !== m) : [...meses, m];
  } else {
    // Clic común: ese mes solo; si ya era el único elegido, vuelve a todo el año.
    out = meses.length === 1 && meses[0] === m ? [] : [m];
  }
  out.sort((x, y) => x - y);
  return out.length === 12 ? [] : out;
}

export default function FiltroPeriodo({ year, meses, minYear, maxYear, onYear, onMeses, onTodoElAnio }) {
  const [anchor, setAnchor] = useState(null);
  const [varios, setVarios] = useState(false);
  const tactil = useMediaQuery('(hover: none)');
  const ancla = useRef(null);
  const clic = (e, m) => {
    const modo = e.shiftKey ? 'tramo' : (e.ctrlKey || e.metaKey || varios) ? 'sumar' : 'solo';
    onMeses(mesesTrasClic(meses, m, modo, ancla.current));
    ancla.current = m;
  };
  const flecha = { width: 28, height: 28, border: 1, borderColor: 'divider', borderRadius: 1.5 };
  return (
    <>
      <Box component="button" type="button" onClick={(e) => setAnchor(e.currentTarget)} sx={sxBotonBarra}>
        <CalendarMonthOutlinedIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
        <Box component="span" sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{year}</Box>
        <Box component="span" sx={{ color: 'text.secondary' }}>·</Box>
        <span>{etiquetaMeses(meses)}</span>
        <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      </Box>
      <Popover
        open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, width: 256, p: 1.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton size="small" aria-label="Año anterior" onClick={() => onYear(year - 1)} disabled={minYear != null && year <= minYear} sx={flecha}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Box sx={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{year}</Box>
          <IconButton size="small" aria-label="Año siguiente" onClick={() => onYear(year + 1)} disabled={maxYear != null && year >= maxYear} sx={flecha}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
          {MESES.map((label, i) => {
            const m = i + 1;
            const activo = meses.includes(m);
            return (
              <Box
                key={m} component="button" type="button" aria-pressed={activo} onClick={(e) => clic(e, m)}
                sx={{
                  all: 'unset', cursor: 'pointer', height: 28, borderRadius: 1.5, border: 1, fontSize: 12, fontWeight: 500, textAlign: 'center',
                  ...(activo
                    ? { bgcolor: 'grey.900', color: '#fff', borderColor: 'grey.900' }
                    : { bgcolor: 'background.paper', color: 'text.secondary', borderColor: 'divider', '&:hover': { borderColor: 'grey.400', color: 'text.primary' } }),
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
        {tactil ? (
          <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'text.secondary', cursor: 'pointer' }}>
            Varios meses
            <Switch size="small" checked={varios} onChange={(e) => setVarios(e.target.checked)} />
          </Box>
        ) : (
          <Box sx={{ fontSize: 11.5, color: 'text.secondary', textAlign: 'center', lineHeight: 1.4 }}>
            Clic: un mes · <b>Ctrl</b> + clic: sumar meses · <b>Shift</b> + clic: un tramo
          </Box>
        )}
        <Box
          component="button" type="button" onClick={onTodoElAnio} disabled={!meses.length}
          sx={{ all: 'unset', cursor: 'pointer', height: 28, textAlign: 'center', fontSize: 12, color: 'text.secondary', '&:hover': { color: 'text.primary' }, '&:disabled': { opacity: 0.4, cursor: 'default' } }}
        >
          Todo el año
        </Box>
      </Popover>
    </>
  );
}
