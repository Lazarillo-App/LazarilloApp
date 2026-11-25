// src/componentes/gestion/FiltroPeriodo.jsx
// Botón "📅 2026 · Todo el año" con su popover (dashboard-filters.tsx de gestion): año con
// flechas (acotado al rango con datos) y los 12 meses para marcar; "Todo el año" limpia.
// Tablero #5 (17/11/2026): un clic = ese mes solo; Ctrl/⌘ + clic suma o saca un mes, Shift + clic suma
// el tramo desde el último elegido. En celular (sin teclado) el interruptor «Varios meses» hace de Ctrl.
// Días (usuaria 25/11/2026: «si quiero ver 1 día hoy no puedo»): con un solo mes elegido aparecen sus
// días; clic = ese día, Shift + clic = el tramo (en celular, «Varios días»). `dias` = «3-8» o «25».

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

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
// eslint-disable-next-line react-refresh/only-export-components -- pura, se testea aparte
export const leerDias = (dias) => {
  const m = String(dias || '').match(/^(\d{1,2})(?:-(\d{1,2}))?$/);
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
};
/** Días que quedan elegidos (pura). modo: 'solo' | 'tramo'; ancla = último día tocado. Devuelve «a-b», «a» o null. */
// eslint-disable-next-line react-refresh/only-export-components -- pura, se testea aparte
export function diasTrasClic(dias, d, modo, ancla) {
  const r = leerDias(dias);
  if (modo === 'tramo' && ancla) {
    const [a, b] = ancla < d ? [ancla, d] : [d, ancla];
    return a === b ? String(a) : `${a}-${b}`;
  }
  // Clic común: ese día solo; si ya era el único elegido, vuelve al mes entero.
  return r && r[0] === d && r[1] === d ? null : String(d);
}
const etiquetaDias = (dias) => { const r = leerDias(dias); return !r ? '' : r[0] === r[1] ? String(r[0]) : `${r[0]}–${r[1]}`; };

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

export default function FiltroPeriodo({ year, meses, minYear, maxYear, onYear, onMeses, onTodoElAnio, dias = null, onDias }) {
  const [anchor, setAnchor] = useState(null);
  const [varios, setVarios] = useState(false);
  const [variosDias, setVariosDias] = useState(false);
  const tactil = useMediaQuery('(hover: none)');
  const ancla = useRef(null);
  const anclaDia = useRef(null);
  const unMes = meses.length === 1 ? meses[0] : null;
  const rango = leerDias(dias);
  const clicDia = (e, d) => {
    const modo = e.shiftKey || (variosDias && anclaDia.current) ? 'tramo' : 'solo';
    onDias?.(diasTrasClic(dias, d, modo, anclaDia.current));
    anclaDia.current = modo === 'tramo' && variosDias ? null : d;
  };
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
        <span>{unMes && dias ? `${etiquetaDias(dias)} ${MESES[unMes - 1]}` : etiquetaMeses(meses)}</span>
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
        {unMes && onDias && (
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.75 }}>
              <Box sx={{ fontSize: 12.5, fontWeight: 600 }}>Días de {MESES[unMes - 1]}</Box>
              <Box component="button" type="button" onClick={() => { onDias(null); anclaDia.current = null; }} disabled={!dias}
                sx={{ all: 'unset', cursor: 'pointer', fontSize: 11.5, color: 'text.secondary', '&:hover': { color: 'text.primary' }, '&:disabled': { opacity: 0.4, cursor: 'default' } }}>
                Todo el mes
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.4 }}>
              {DIAS_SEMANA.map((x) => <Box key={x} sx={{ fontSize: 10.5, color: 'text.disabled', textAlign: 'center' }}>{x}</Box>)}
              {Array.from({ length: (new Date(year, unMes - 1, 1).getDay() + 6) % 7 }, (_, i) => <span key={`v${i}`} />)}
              {Array.from({ length: new Date(year, unMes, 0).getDate() }, (_, i) => {
                const d = i + 1;
                const dentro = rango && d >= rango[0] && d <= rango[1];
                const borde = rango && (d === rango[0] || d === rango[1]);
                return (
                  <Box key={d} component="button" type="button" aria-pressed={!!dentro} onClick={(e) => clicDia(e, d)}
                    sx={{
                      all: 'unset', cursor: 'pointer', height: 26, borderRadius: 1.25, fontSize: 11.5, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                      ...(borde ? { bgcolor: 'grey.900', color: '#fff' }
                        : dentro ? { bgcolor: 'grey.200', color: 'text.primary' }
                          : { color: 'text.secondary', '&:hover': { bgcolor: 'grey.100', color: 'text.primary' } }),
                    }}>
                    {d}
                  </Box>
                );
              })}
            </Box>
            {tactil ? (
              <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'text.secondary', cursor: 'pointer', mt: 0.5 }}>
                Varios días (tocá el primero y el último)
                <Switch size="small" checked={variosDias} onChange={(e) => { setVariosDias(e.target.checked); anclaDia.current = null; }} />
              </Box>
            ) : (
              <Box sx={{ fontSize: 11.5, color: 'text.secondary', textAlign: 'center', lineHeight: 1.4, mt: 0.75 }}>
                Clic: un día · <b>Shift</b> + clic: un tramo
              </Box>
            )}
          </Box>
        )}
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
