// src/componentes/RecetaModal/FilaResultadoInsumo.jsx
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { PRIMARY, fmt, fmtDate, getAlertaColor, canonicalUnit } from './helpers';

/**
 * Fila de resultado de búsqueda (insumo). Compartida entre el buscador de
 * ingredientes y la lupa del header. Presentación pura: mismas reglas de
 * costo (4 casos), colores por compras, badges y fecha.
 * @param {object} ins - insumo (con campos receta_*, precio_*, fecha_ultima_compra)
 * @param {object} opts - { alertaSemanas, onClick, keySuffix, selected }
 */
export default function FilaResultadoInsumo({ ins, alertaSemanas, onClick, selected = false }) {
  const esElab = ins.es_elaborado === true || ins.tiene_receta === true;
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5, py: 0.75, cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
      }}>
      <Box>
        <Typography component="span" variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem', display: 'block' }}>
          {ins.nombre}
          {!esElab && <Chip label="Insumo" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: `${PRIMARY}15`, color: PRIMARY }} />}
          {esElab && <Chip label="Elaborado" size="small" sx={{ ml: 0.5, height: 16, fontSize: 9, bgcolor: '#f0fdf4', color: '#16a34a' }} />}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {ins.codigo_maxi || ins.codigo_mostrar ? `Cód: ${ins.codigo_maxi || ins.codigo_mostrar} · ${ins.unidad_med || ins.medida || 'u'}` : ins.unidad_med || ins.medida || 'u'}
          {(() => {
            if (esElab) {
              const f = fmtDate(ins.receta_updated_at);
              return f ? ` · Mod: ${f}` : '';
            }
            const f = fmtDate(ins.fecha_ultima_compra);
            return f ? ` · Compra: ${f}` : ' · Sin compras';
          })()}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0, ml: 1 }}>
        {(() => {
          if (esElab) {
            const porc = Number(ins.receta_porciones) || 1;
            const costoUnit = Number(ins.receta_costo_unitario) || 0;
            const costoTot = Number(ins.costo_receta) || 0;
            const rendU = ins.receta_rend_unidad || 'porcion';
            const conRendimiento = porc > 1;
            const valor = conRendimiento ? costoUnit : costoTot;
            const etiqueta = conRendimiento
              ? (rendU === 'porcion' ? '/porción' : `/${canonicalUnit(rendU)}`)
              : '';
            return (
              <Typography variant="body2" fontWeight={700} sx={{ color: '#16a34a', fontSize: '0.8rem' }}>
                {valor > 0 ? `$${fmt(valor)}${etiqueta}` : ''}
              </Typography>
            );
          }
          const p = Number(ins.precio_ref) || Number(ins.precio_promedio_periodo) || Number(ins.precio_promedio) || Number(ins.precio_ultima_compra) || Number(ins.precio) || 0;
          const sinCompraReciente = !!getAlertaColor(ins.fecha_ultima_compra, alertaSemanas, false);
          const tieneCompraAlDia = !!ins.fecha_ultima_compra && !sinCompraReciente;
          const colorPrecio = sinCompraReciente ? '#ef4444' : (tieneCompraAlDia ? '#16a34a' : PRIMARY);
          return (
            <>
              {sinCompraReciente && (
                <Tooltip title={ins.fecha_ultima_compra
                  ? `Última compra: ${fmtDate(ins.fecha_ultima_compra)} — precio posiblemente desactualizado`
                  : 'Sin compras registradas — precio de referencia, no de compra'}>
                  <WarningAmberIcon sx={{ fontSize: 13, color: '#ef4444' }} />
                </Tooltip>
              )}
              <Typography variant="body2" fontWeight={700} sx={{ color: colorPrecio, fontSize: '0.8rem' }}>
                {p > 0 ? `$${fmt(p)}` : '—'}
              </Typography>
            </>
          );
        })()}
      </Box>
    </Box>
  );
}
