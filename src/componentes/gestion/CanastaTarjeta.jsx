// src/componentes/gestion/CanastaTarjeta.jsx
// "Tu canasta" (inflación propia), igual a lazarillo_gestion/components/dashboard/canasta-tarjeta.tsx:
// la tarjeta chica de la fila del último mes cerrado y el detalle a todo el ancho.

import React, { useState } from 'react';
import { Box, Table, TableHead, TableBody, TableRow, TableCell, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { acumulada, pesoRelativo, ventanaUltimoAumento } from '@/gestion/canasta';
import { alcanceAumento, aumentosVsCostos, GRUPOS, NOMBRE_GRUPO } from '@/gestion/aumentos';

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VIOLETA = '#6d28d9';
const VIOLETA_BORDE = '#ddd6fe';
const ROJO = '#dc2626';
const VERDE = '#047857';
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const pct = (x, signo = true) =>
  x == null ? '—' : `${signo && x > 0 ? '+' : ''}${(x * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const COMO = {
  sueldos: 'mismo empleado mes a mes, sin SAC',
  mercaderias: 'precio por insumo, canasta fija',
  servicios: 'por proveedor × concepto',
  alquiler: 'en revisión: no entra al %',
};

/** Tooltip del aumento: cuánto subió cada agrupación. */
function detalleAumento(a) {
  const base = a.origen === 'detectado' ? 'Detectado en el informe 12' : 'Cargado a mano';
  if (!a.detalle) return base;
  const partes = GRUPOS.filter((g) => a.detalle?.[g] != null).map((g) => `${NOMBRE_GRUPO[g]} ${pct(a.detalle[g])}`);
  return `${base}${partes.length ? ` · ${partes.join(' · ')}` : ''}${a.provisorio ? ' · provisorio' : ''}`;
}

/** Contenido de la tarjeta chica (dentro de la fila del último mes cerrado). */
export function CanastaMini({ r }) {
  const principal = r.base ? r.desde : r.mes;
  return (
    <>
      <Box component="b" sx={{ display: 'block', fontSize: 18, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25, color: (principal ?? 0) > 0 ? VIOLETA : undefined }}>{pct(principal)}</Box>
      <Box sx={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, color: 'text.secondary' }}>
        {r.base ? <>desde {ddmm(r.base)} (aumento)</> : <>en el mes</>}
      </Box>
      <Box sx={{ fontSize: 11.5, lineHeight: 1.4, color: 'text.secondary' }}>12 meses {pct(r.doce)}</Box>
    </>
  );
}

const sxTh = { fontSize: 11.5, color: 'text.secondary', fontWeight: 500, py: 0.5, px: 1.5, borderBottom: 0 };
const sxTd = { fontSize: 13, py: 0.75, px: 1.5, borderBottom: 0, borderTop: `1px solid ${VIOLETA_BORDE}` };

/** Detalle a todo el ancho (al tocar la tarjeta). */
export function CanastaDetalle({ d, r, mesRef, conSucursal, onAgregar, onQuitar, onCerrar }) {
  const [nueva, setNueva] = useState('');
  const filas = aumentosVsCostos(d.meses, r.serie, d.aumentos).filter((f) => f.costos != null);
  const ultimoAum = d.aumentos.length ? d.aumentos[d.aumentos.length - 1] : null;
  const aumPorFecha = new Map(d.aumentos.map((a) => [a.fecha, a]));
  const ult = d.meses.length - 1;
  const v = ventanaUltimoAumento(d.meses, d.aumentos.map((a) => a.fecha));
  const pesos = pesoRelativo(d.componentes);
  const nombreMes = MES[mesRef - 1];
  const num = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const fila = (c) => {
    const desde = v.desdeIdx == null ? null : v.desdeIdx > ult ? 0 : acumulada(c.variaciones, v.desdeIdx, ult);
    return (
      <TableRow key={c.clave} sx={!c.cuenta ? { '& td': { color: 'text.disabled' } } : undefined}>
        <TableCell sx={{ ...sxTd, pl: 0 }}>
          {c.nombre}
          {!c.cuenta && <Box component="span" sx={{ ml: 0.75, border: 1, borderColor: 'grey.400', borderRadius: 0.5, px: 0.5, fontSize: 10 }}>en revisión</Box>}
        </TableCell>
        <TableCell sx={{ ...sxTd, ...num }}>{c.cuenta ? pct(pesos.get(c.clave), false).replace(',0%', '%') : '—'}</TableCell>
        <TableCell sx={{ ...sxTd, ...num, ...(c.cuenta && (c.variaciones[ult] ?? 0) > 0.02 ? { color: ROJO } : {}) }}>{pct(c.variaciones[ult])}</TableCell>
        <TableCell sx={{ ...sxTd, ...num }}>{pct(acumulada(c.variaciones, ult - 2, ult))}</TableCell>
        <TableCell sx={{ ...sxTd, ...num }}>{pct(acumulada(c.variaciones, 0, ult))}</TableCell>
        {v.base && <TableCell sx={{ ...sxTd, ...num }}>{pct(desde)}</TableCell>}
        <TableCell sx={{ ...sxTd, fontSize: 11.5, color: 'text.secondary' }}>
          {COMO[c.clave]}{c.clave === 'mercaderias' && c.aRevisar ? ` · ${c.aRevisar} insumos con saltos raros apartados` : ''}
        </TableCell>
      </TableRow>
    );
  };
  return (
    <Box sx={{ mt: 1.5, borderRadius: 3, border: '1px solid #c4b5fd', bgcolor: 'rgba(245,243,255,.6)', p: 2 }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1.5 }}>
          <Box component="b" sx={{ fontSize: 15, color: VIOLETA }}>Tu canasta · {nombreMes}</Box>
          <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>cuánto subieron TUS costos, ponderado por lo que pesa cada uno en tus gastos (últimos 6 meses)</Box>
        </Box>
        <Box component="button" type="button" onClick={onCerrar} sx={{ all: 'unset', cursor: 'pointer', flexShrink: 0, fontSize: 12, fontWeight: 600, color: VIOLETA, '&:hover': { textDecoration: 'underline' } }}>▴ cerrar</Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { lg: '1fr 360px' } }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...sxTh, pl: 0 }}>Componente</TableCell>
                <TableCell sx={{ ...sxTh, textAlign: 'right' }}>Peso</TableCell>
                <TableCell sx={{ ...sxTh, textAlign: 'right', textTransform: 'capitalize' }}>{nombreMes.slice(0, 3)}</TableCell>
                <TableCell sx={{ ...sxTh, textAlign: 'right' }}>3 meses</TableCell>
                <TableCell sx={{ ...sxTh, textAlign: 'right' }}>12 meses</TableCell>
                {v.base && <TableCell sx={{ ...sxTh, textAlign: 'right' }}>Desde {ddmm(v.base)}</TableCell>}
                <TableCell sx={sxTh}>Cómo se mide</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {d.componentes.filter((c) => c.cuenta).map(fila)}
              {d.componentes.filter((c) => !c.cuenta).map(fila)}
              <TableRow sx={{ '& td': { fontWeight: 700, color: VIOLETA, borderTop: '2px solid #ddd6fe' } }}>
                <TableCell sx={{ ...sxTd, pl: 0 }}>Tu canasta</TableCell>
                <TableCell sx={{ ...sxTd, ...num }}>100%</TableCell>
                <TableCell sx={{ ...sxTd, ...num }}>{pct(r.mes)}</TableCell>
                <TableCell sx={{ ...sxTd, ...num }}>{pct(r.tres)}</TableCell>
                <TableCell sx={{ ...sxTd, ...num }}>{pct(r.doce)}</TableCell>
                {v.base && <TableCell sx={{ ...sxTd, ...num }}>{pct(r.desde)}</TableCell>}
                <TableCell sx={{ ...sxTd, fontSize: 11.5, fontWeight: '400 !important', color: 'text.secondary !important' }}>mes a mes salta; mirá 3 meses o desde el aumento</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,.7)', p: 1.5, fontSize: 13 }}>
          {filas.length > 0 && (
            <div>
              <Box sx={{ mb: 0.5, fontSize: 12, color: 'text.secondary' }}>Cada aumento contra lo que subieron tus costos desde el anterior</Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...sxTh, px: 0, fontSize: 11 }}>Aumento</TableCell>
                    <TableCell sx={{ ...sxTh, px: 0, fontSize: 11, textAlign: 'right' }}>Carta</TableCell>
                    <TableCell sx={{ ...sxTh, px: 0, fontSize: 11, textAlign: 'right' }}>Costos</TableCell>
                    <TableCell sx={{ ...sxTh, px: 0, fontSize: 11, textAlign: 'right' }}>Brecha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filas.map((f) => {
                    const a = aumPorFecha.get(f.fecha);
                    const alcance = alcanceAumento(a?.detalle);
                    return (
                      <TableRow key={f.fecha}>
                        <TableCell sx={{ ...sxTd, px: 0, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }} title={a ? detalleAumento(a) : undefined}>
                          {ddmm(f.fecha)}{f.provisorio && <Box component="span" sx={{ color: 'text.secondary' }}>*</Box>}
                          {alcance && <Box component="span" sx={{ ml: 0.5, fontSize: 11, color: 'text.secondary' }}>{alcance}</Box>}
                        </TableCell>
                        <TableCell sx={{ ...sxTd, px: 0, fontSize: 12.5, ...num }}>{pct(f.carta)}</TableCell>
                        <TableCell sx={{ ...sxTd, px: 0, fontSize: 12.5, ...num }} title={f.hastaMes ? `hasta ${MES[Number(f.hastaMes.slice(5)) - 1]}` : undefined}>
                          {pct(f.costos)}{f.hastaMes && <Box component="span" sx={{ color: 'text.secondary' }}>¹</Box>}
                        </TableCell>
                        <TableCell sx={{ ...sxTd, px: 0, fontSize: 12.5, ...num, fontWeight: 600, color: f.brecha == null ? undefined : f.brecha >= 0 ? VERDE : ROJO }}>
                          {f.brecha == null ? '—' : `${f.brecha >= 0 ? '+' : '−'}${Math.abs(f.brecha * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} pts`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Box sx={{ mt: 0.5, fontSize: 11, lineHeight: 1.4, color: 'text.secondary' }}>
                Brecha positiva = el aumento cubrió lo que subieron tus costos.{filas.some((f) => f.provisorio) && ' * provisorio.'}{filas.some((f) => f.hastaMes) && ` ¹ costos hasta ${nombreMes}.`}
              </Box>
            </div>
          )}
          {r.base && ultimoAum && ultimoAum.fecha.slice(0, 7) <= d.meses[d.meses.length - 1] && (
            <div>
              Desde el {ddmm(r.base)} tus costos subieron <Box component="b" sx={{ color: VIOLETA }}>{pct(r.desde)}</Box>: para volver al margen de entonces,{' '}
              <Box component="b" sx={{ color: VIOLETA }}>aumentar ~{pct(r.desde, false)}</Box>.
            </div>
          )}
          {!r.base && (
            <Box sx={{ fontSize: 12, color: 'text.secondary' }}>Anotá la fecha de tu último aumento de precios para ver cuánto subieron tus costos desde entonces.</Box>
          )}
          {conSucursal && (
            <Box sx={{ mt: 0.5, borderTop: `1px solid ${VIOLETA_BORDE}`, pt: 1 }}>
              <Box sx={{ mb: 0.5, fontSize: 12, color: 'text.secondary' }} title="Se detectan solos cada noche del informe 12; acá se corrigen">Aumentos de precios</Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {d.aumentos.filter((a) => a.fecha.slice(0, 7) >= d.meses[0]).map((a) => (
                  <Box
                    key={a.fecha} component="span" title={detalleAumento(a)}
                    sx={{ display: 'inline-flex', height: 24, alignItems: 'center', gap: 0.5, borderRadius: 1.5, border: `1px solid ${VIOLETA_BORDE}`, bgcolor: 'background.paper', pl: 1, pr: 0.25, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {ddmm(a.fecha)}/{a.fecha.slice(2, 4)}
                    {a.pct != null && <Box component="b" sx={{ ml: 0.25, color: VIOLETA }}>{pct(a.pct)}{a.provisorio ? '*' : ''}</Box>}
                    {alcanceAumento(a.detalle) && <Box component="span" sx={{ fontSize: 10.5, color: 'text.secondary' }}>{alcanceAumento(a.detalle)}</Box>}
                    <IconButton size="small" aria-label={`Quitar aumento del ${ddmm(a.fecha)}`} onClick={() => onQuitar(a.fecha)} sx={{ p: 0.25 }}>
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  component="input" type="date" value={nueva} onChange={(e) => setNueva(e.target.value)} aria-label="Fecha del aumento"
                  sx={{ height: 28, flex: 1, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1, fontSize: 12 }}
                />
                <Box
                  component="button" type="button" disabled={!nueva} onClick={() => { onAgregar(nueva); setNueva(''); }}
                  sx={{ all: 'unset', cursor: 'pointer', height: 28, borderRadius: 1.5, bgcolor: '#7c3aed', px: 1.25, fontSize: 12, fontWeight: 500, color: '#fff', display: 'inline-flex', alignItems: 'center', '&:disabled': { opacity: 0.4, cursor: 'default' } }}
                >
                  Agregar
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
