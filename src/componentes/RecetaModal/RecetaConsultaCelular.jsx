// src/componentes/RecetaModal/RecetaConsultaCelular.jsx
//
// Receta en el celular: SOLO CONSULTA (Diego 20/11/2026: «no quiero editar nada desde el celular»).
// Arriba lo que sirve para decidir (precio, costo, % costo, lo que queda y el precio para llegar al
// objetivo); abajo los ingredientes en tarjetas, con cuánto pesa cada uno en el costo. Sin campos ni
// Guardar/Borrar: para editar, la receta se abre en la compu. Los números llegan calculados del modal
// (index.jsx), con la misma lógica que la vista de escritorio (calcCosto).
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { PRIMARY, ON_PRIMARY } from './helpers';

const pesos = (v, d = 2) => `$ ${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (v) => `${Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const cant = (v) => Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 });
const NUM = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

function Kpi({ titulo, valor, color }) {
  return (
    <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>{titulo}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: color || 'text.primary', ...NUM, overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor}</Typography>
    </Box>
  );
}

export default function RecetaConsultaCelular({
  tipo = 'RECETA', id, nombre, loading,
  items = [], costoTotal = 0, costoPorcion = 0,
  precioActual = 0, pctCostoActual = null, pctObjetivo = 0, precioObjetivo = 0,
  promo = false, ventaSinPromo = 0,
  canNavigate = { prev: false, next: false }, onNavigate, onClose,
  conFicha = false, onFicha,
}) {
  const queda = precioActual > 0 ? precioActual - costoPorcion : null;
  const pasado = pctCostoActual != null && pctObjetivo > 0 && pctCostoActual > pctObjetivo + 0.05;
  const diferencia = precioObjetivo > 0 && precioActual > 0 ? precioObjetivo - precioActual : 0;
  const lista = items.filter((it) => it.nombre || it.costo > 0);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: '#f4f6f8' }}>
      {/* Encabezado chico: 56 px, como el header del celular */}
      <Box sx={{ bgcolor: PRIMARY, color: ON_PRIMARY, flexShrink: 0 }}>
        <Box sx={{ height: 56, display: 'flex', alignItems: 'center', px: 0.5 }}>
          <IconButton onClick={onClose} sx={{ color: 'inherit', width: 44, height: 44 }} aria-label="Cerrar"><CloseIcon /></IconButton>
          <IconButton disabled={!canNavigate?.prev || !onNavigate} onClick={() => onNavigate?.('prev')}
            sx={{ color: 'inherit', width: 44, height: 44, '&.Mui-disabled': { color: 'inherit', opacity: 0.3 } }} aria-label="Anterior"><ChevronLeftIcon /></IconButton>
          <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 11, opacity: 0.75, letterSpacing: '.06em', lineHeight: 1.2 }}>{`${tipo}${id != null ? ` · #${id}` : ''}`}</Typography>
            <Typography sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre || 'Sin nombre'}</Typography>
          </Box>
          <IconButton disabled={!canNavigate?.next || !onNavigate} onClick={() => onNavigate?.('next')}
            sx={{ color: 'inherit', width: 44, height: 44, '&.Mui-disabled': { color: 'inherit', opacity: 0.3 } }} aria-label="Siguiente"><ChevronRightIcon /></IconButton>
          <Box sx={{ width: 44 }} />
        </Box>
        {conFicha && (
          <Box sx={{ display: 'flex', gap: 0.75, px: 2, pb: 1.25 }}>
            {[['ficha', 'FICHA'], ['receta', 'RECETA']].map(([k, l]) => (
              <Box key={k} component="button" type="button" onClick={k === 'ficha' ? onFicha : undefined}
                sx={{ flex: 1, height: 36, border: 0, borderRadius: 2, font: 'inherit', fontWeight: 700, fontSize: 13, letterSpacing: '.05em',
                  cursor: k === 'ficha' ? 'pointer' : 'default',
                  bgcolor: k === 'receta' ? '#fff' : 'rgba(255,255,255,.14)', color: k === 'receta' ? PRIMARY : 'inherit' }}>
                {l}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Cuerpo */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 1.75 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : !lista.length ? (
          <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 2.5, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Todavía no tiene receta</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Se arma desde la compu: ahí cargás los ingredientes y acá ves cuánto te cuesta.</Typography>
          </Box>
        ) : (<>
          <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 1.75, boxShadow: '0 1px 3px rgba(15,23,42,.08)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>Precio actual</Typography>
                <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, ...NUM }}>{precioActual > 0 ? pesos(precioActual) : 'Sin precio'}</Typography>
              </Box>
              {promo && ventaSinPromo > 0 && (
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>Sin promo</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary', textDecoration: 'line-through', ...NUM }}>{pesos(ventaSinPromo)}</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mt: 1.5 }}>
              <Kpi titulo="Costo" valor={pesos(costoPorcion)} />
              <Kpi titulo="% costo" valor={pctCostoActual != null ? pct(pctCostoActual) : '—'} color={pasado ? '#dc2626' : pctCostoActual != null ? '#15803d' : undefined} />
              <Kpi titulo="Te queda" valor={queda != null ? pesos(queda, 0) : '—'} color={queda != null ? (queda >= 0 ? '#15803d' : '#dc2626') : undefined} />
            </Box>
            {pctObjetivo > 0 && precioObjetivo > 0 && (
              <Box sx={{ mt: 1.25, fontSize: 13, lineHeight: 1.35, borderRadius: 2, px: 1.25, py: 1,
                bgcolor: pasado ? '#fff7ed' : '#f0fdf4', color: pasado ? '#9a3412' : '#166534' }}>
                {pasado
                  ? <>Objetivo {pct(pctObjetivo)}: para llegar, el precio sería <b style={NUM}>{pesos(precioObjetivo, 0)}</b>{diferencia > 0 ? ` (+${pesos(diferencia, 0)})` : ''}.</>
                  : <>Dentro del objetivo ({pct(pctObjetivo)}).</>}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2.25, mb: 1, px: 0.25 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{`Ingredientes (${lista.length})`}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>% del costo</Typography>
          </Box>
          {lista.map((it, i) => {
            const share = costoTotal > 0 ? (it.costo / costoTotal) * 100 : 0;
            return (
              <Box key={it.key ?? i} sx={{ bgcolor: '#fff', borderRadius: 2.5, px: 1.75, py: 1.5, mb: 1, boxShadow: '0 1px 2px rgba(15,23,42,.06)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{it.nombre || 'Sin nombre'}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>
                      {`${cant(it.cantidad)} ${it.unidad || ''} · ${share > 0 && share < 1 ? '< 1' : Math.round(share)} %`}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, ...NUM }}>{pesos(it.costo)}</Typography>
                    {it.sinPromo > 0 && (
                      <Typography sx={{ fontSize: 12, color: '#7c3aed', ...NUM }}>{`sin promo ${pesos(it.sinPromo, 0)}`}</Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ height: 5, bgcolor: '#eef2f6', borderRadius: 1, mt: 1.1, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.min(100, Math.max(0, share))}%`, bgcolor: '#5BC2EA' }} />
                </Box>
              </Box>
            );
          })}
        </>)}
      </Box>

      {/* Pie fijo: solo consulta */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.25, px: 2, pt: 1.25,
        pb: 'calc(14px + env(safe-area-inset-bottom))', bgcolor: '#fff', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ flex: 1, fontSize: 12, color: 'text.secondary', lineHeight: 1.3 }}>
          Solo consulta. Para editar la receta, abrila en la compu.
        </Typography>
        <Box component="button" type="button" onClick={onClose}
          sx={{ height: 44, px: 2.75, border: 0, borderRadius: 2, bgcolor: PRIMARY, color: ON_PRIMARY, font: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Cerrar
        </Box>
      </Box>
    </Box>
  );
}
