// src/componentes/gestion/ActualizadoAl.jsx
// "Actualizado al" del Panel (lazarillo_gestion/components/dashboard/actualizado-al.tsx): un punto
// de color según qué tan viejas son las ventas (verde hasta ayer, ámbar 2-3 días, rojo más).
// variante="punto" (compu): solo el punto al lado del título y las fechas en el tooltip.
// variante="chip" (celu): el chip con las fechas.

import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { useActualizado } from '@/gestion/hooksPanel';
import { frescura, hoyArgentina, diasAtras } from '@/gestion/frescura';

const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const PUNTO = { al_dia: '#059669', atrasado: '#f59e0b', viejo: '#dc2626' };
const LEYENDA = { al_dia: 'al día', atrasado: 'atrasado', viejo: 'desactualizado' };

export default function ActualizadoAl({ variante = 'chip', nombre }) {
  const { data } = useActualizado();
  const base = data?.ventas ?? data?.compras;
  if (!base) return null;
  const hoy = hoyArgentina();
  const estado = frescura(base, hoy);
  const dias = diasAtras(base, hoy);
  const imp = data?.importado ? new Date(data.importado) : null;
  const lectura = imp ? `${imp.toLocaleDateString('es-AR')} ${imp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : null;
  const titulo = [
    `${nombre}: ${LEYENDA[estado]} (ventas de hace ${dias} día${dias === 1 ? '' : 's'})`,
    lectura ? `Última lectura: ${lectura}` : null,
  ].filter(Boolean).join(' · ');
  const fechas = (
    <>
      {data?.ventas && <>ventas {ddmm(data.ventas)}</>}
      {data?.ventas && data?.compras && ' · '}
      {data?.compras && <>compras {ddmm(data.compras)}</>}
    </>
  );

  if (variante === 'punto') {
    return (
      <Tooltip
        enterDelay={150}
        placement="bottom-start"
        title={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, fontSize: 12, lineHeight: 1.4 }}>
            <Box sx={{ fontWeight: 500 }}>{nombre} · {LEYENDA[estado]}</Box>
            <div>{fechas}</div>
            {lectura && <Box sx={{ opacity: 0.8 }}>Última lectura: {lectura}</Box>}
          </Box>
        }
      >
        <Box component="button" type="button" aria-label={titulo} sx={{ all: 'unset', cursor: 'help', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: PUNTO[estado] }} />
        </Box>
      </Tooltip>
    );
  }
  return (
    <Box
      component="span" title={titulo}
      sx={{ display: 'inline-flex', maxWidth: '100%', alignItems: 'center', gap: 0.75, borderRadius: 999, border: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1.25, py: 0.25, fontSize: 12, color: 'text.primary', cursor: 'help' }}
    >
      <Box component="span" sx={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', bgcolor: PUNTO[estado] }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {nombre}{data?.ventas && <> · ventas {ddmm(data.ventas)}</>}{data?.compras && <> · compras {ddmm(data.compras)}</>}
      </Box>
    </Box>
  );
}
