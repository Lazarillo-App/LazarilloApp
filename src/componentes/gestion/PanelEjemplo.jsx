// src/componentes/gestion/PanelEjemplo.jsx
// Panel de gestión SIN DATOS (Diego 14/11/2026, regla «todavía no hay datos» del 12/11):
// en vez de «Sin datos para los filtros seleccionados», una tarjeta con el primer paso y una
// vista previa de EJEMPLO atenuada (no editable, vive solo acá, nunca se guarda) de cómo se ve
// el panel cuando hay ventas y gastos. Cada parte que se completa sola lleva su línea gris.
import React from 'react';
import { Box, Typography, Button, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { MESES } from '@/gestion/formato';
import { RESULT_COLORS } from '@/gestion/resultadosCalc';
import { ANT } from '@/componentes/asistente/anthonyAssets';

// Un año inventado de un bar chico (millones de pesos por mes). Cierra: resultado = ingresos − egresos.
const VENTAS = [38.2, 35.1, 41.5, 44.0, 46.8, 43.9, 52.4, 49.7, 47.2, 50.9, 53.6, 61.3];
const RUBROS = [
  { nombre: 'Mercaderías', pct: 0.34, origen: 'llegan solas de las compras de tu punto de venta' },
  { nombre: 'Gastos en personal', pct: 0.27, origen: 'sueldos y cargas: los cargás vos o llegan de tu PDV' },
  { nombre: 'Alquiler y servicios', fijo: 6.4 },
  { nombre: 'Impuestos', pct: 0.07 },
  { nombre: 'Mantenimiento', fijo: 1.8 },
];
const valorRubro = (r, i) => (r.fijo != null ? r.fijo + (i % 3) * 0.2 : VENTAS[i] * r.pct);
const egresos = VENTAS.map((_, i) => RUBROS.reduce((a, r) => a + valorRubro(r, i), 0));
const M = (v) => `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;

// Tarjeta del primer paso. soloVentas: ya hay gastos cargados pero ninguna venta (falta conectar el PDV).
export function PrimerPaso({ onCargar, onConectar, puedeCargar, soloVentas = false }) {
  return (
    <Box data-tour="panel-primer-paso" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: soloVentas ? 1.5 : 2, borderRadius: 3, border: '1px solid #5BC2EA', bgcolor: '#eef8fd' }}>
      <Box component="img" src={ANT.presenta} alt="" sx={{ height: soloVentas ? 52 : 76, width: 'auto', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: soloVentas ? 14.5 : 16 }}>
          {soloVentas ? 'Faltan tus ventas' : 'Tu panel todavía no tiene datos'}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 0.5 }}>
          {soloVentas
            ? <>Ya cargaste gastos. Conectá tu punto de venta y las <b>ventas</b> entran solas: así el panel calcula <b>qué te queda</b> cada mes.</>
            : <>Cuando conectes tu punto de venta, las <b>ventas</b> y las <b>compras</b> entran solas y acá ves cuánto vendiste, en qué gastaste y <b>qué te queda</b> cada mes. Mientras, podés cargar tu primer gasto. Abajo tenés un ejemplo de cómo se ve.</>}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
        <Button variant="contained" disableElevation onClick={onConectar} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>Conectar mi punto de venta</Button>
        {puedeCargar && !soloVentas && <Button variant="outlined" onClick={onCargar} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>+ Cargar un gasto</Button>}
      </Box>
    </Box>
  );
}

export default function PanelEjemplo({ onCargar, onConectar, puedeCargar }) {
  const celda = { fontSize: 12.5, py: 0.9, px: 1, textAlign: 'right', whiteSpace: 'nowrap', borderColor: 'divider' };
  const nombre = { fontSize: 12.5, py: 0.9, px: 1.5, whiteSpace: 'nowrap', borderColor: 'divider' };
  const gris = { display: 'block', fontSize: 10.5, color: 'text.secondary', fontWeight: 400, mt: 0.25 };
  return (
    <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PrimerPaso onCargar={onCargar} onConectar={onConectar} puedeCargar={puedeCargar} />

      {/* Vista previa de EJEMPLO: atenuada y sin interacción */}
      <Box aria-hidden data-tour="panel-ejemplo">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box component="span" sx={{ px: 1.25, py: 0.25, borderRadius: 999, bgcolor: '#15213E', color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>EJEMPLO</Box>
          <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary' }}>Así se ve tu panel con un año de datos (los números son inventados).</Typography>
        </Box>
        <Box sx={{ opacity: 0.55, pointerEvents: 'none', userSelect: 'none', border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'auto' }}>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ ...nombre, fontWeight: 700 }}>Operación</TableCell>
                {MESES.map((m) => <TableCell key={m} sx={{ ...celda, fontWeight: 700 }}>{m}</TableCell>)}
                <TableCell sx={{ ...celda, fontWeight: 700 }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ ...nombre, fontWeight: 700 }}>Ingresos<Box component="span" sx={gris}>llegan solos de tu punto de venta</Box></TableCell>
                {VENTAS.map((v, i) => <TableCell key={i} sx={celda}>{M(v)}</TableCell>)}
                <TableCell sx={{ ...celda, fontWeight: 700 }}>{M(VENTAS.reduce((a, b) => a + b, 0))}</TableCell>
              </TableRow>
              {RUBROS.map((r) => (
                <TableRow key={r.nombre}>
                  <TableCell sx={{ ...nombre, pl: 3 }}>{r.nombre}{r.origen && <Box component="span" sx={gris}>{r.origen}</Box>}</TableCell>
                  {VENTAS.map((_, i) => <TableCell key={i} sx={celda}>{M(valorRubro(r, i))}</TableCell>)}
                  <TableCell sx={{ ...celda, fontWeight: 600 }}>{M(VENTAS.reduce((a, _, i) => a + valorRubro(r, i), 0))}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ ...nombre, fontWeight: 700 }}>Egresos</TableCell>
                {egresos.map((v, i) => <TableCell key={i} sx={{ ...celda, fontWeight: 600 }}>{M(v)}</TableCell>)}
                <TableCell sx={{ ...celda, fontWeight: 700 }}>{M(egresos.reduce((a, b) => a + b, 0))}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ ...nombre, fontWeight: 800 }}>Resultado<Box component="span" sx={gris}>lo que te queda: se calcula solo</Box></TableCell>
                {VENTAS.map((v, i) => {
                  const r = v - egresos[i];
                  return <TableCell key={i} sx={{ ...celda, fontWeight: 800, color: r >= 0 ? RESULT_COLORS.positive : RESULT_COLORS.negative }}>{M(r)}</TableCell>;
                })}
                <TableCell sx={{ ...celda, fontWeight: 800, color: RESULT_COLORS.positive }}>{M(VENTAS.reduce((a, b) => a + b, 0) - egresos.reduce((a, b) => a + b, 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
