// src/componentes/VentasMiniGraficoModal.jsx
import React, { useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Button, Typography,
  Table, TableHead, TableRow, TableCell, TableBody, Stack, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function VentasMiniGraficoModal({
  open, onClose, articuloNombre, rango, data, loading
}) {
  // ✅ Obtener colores del tema del negocio
  const themeColors = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        primary: '#3b82f6',
        secondary: '#10b981',
        background: '#f9fafb'
      };
    }

    const root = document.documentElement;
    const styles = getComputedStyle(root);

    return {
      primary: styles.getPropertyValue('--color-primary')?.trim() || '#3b82f6',
      secondary: styles.getPropertyValue('--color-secondary')?.trim() || '#10b981',
      background: styles.getPropertyValue('--color-background')?.trim() || '#f9fafb',
      onPrimary: styles.getPropertyValue('--on-primary')?.trim() || '#ffffff',
      onSecondary: styles.getPropertyValue('--on-secondary')?.trim() || '#ffffff',
    };
  }, []);

  // helper robusto para qty (alineado con TablaArticulos)
  const getItemQty = (it) => {
    if (!it) return 0;

    const v = Number(
      it.qty ??
      it.quantity ??
      it.cantidad ??
      it.unidades ??
      it.total_u ??
      it.total_qty ??
      it.qty_sum ??
      it.qtyMap ??
      0
    );
    return Number.isNaN(v) ? 0 : v;
  };

  const chartData = useMemo(() => {
    const baseItems =
      (Array.isArray(data?.items) && data.items) ||
      (Array.isArray(data?.data?.items) && data.data.items) ||
      (Array.isArray(data?.series) && data.series) ||
      (Array.isArray(data?.data?.series) && data.data.series) ||
      [];

    if (!rango?.from || !rango?.to) return [];

    // Completar calendario día por día
    const map = new Map();
    for (const it of baseItems) {
      const raw = String(
        it.label ??
        it.date ??
        it.day ??
        it.fecha ??
        ''
      );
      if (!raw) continue;

      const dayKey = raw.slice(0, 10);
      const qty = getItemQty(it);
      map.set(dayKey, (map.get(dayKey) || 0) + qty);
    }

    const from = parseISO(rango.from); 
    const to = parseISO(rango.to);

    const seq = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const dayKey = format(d, 'yyyy-MM-dd');
      seq.push({
        label: dayKey,
        qty: map.get(dayKey) || 0,
      });
    }

    // Calcular acumulado
    let acc = 0;
    return seq.map((d, i) => {
      acc += d.qty;
      return {
        idx: i + 1,
        label: d.label,
        qty: d.qty,
        acumulado: acc
      };
    });
  }, [data, rango?.from, rango?.to]);

  // Total
  const totalFooter = useMemo(() => {
    if (chartData.length > 0) {
      return chartData.reduce((acc, d) => acc + (Number(d.qty) || 0), 0);
    }

    const direct =
      (typeof data?.total === 'number' && !Number.isNaN(data.total))
        ? data.total
        : (typeof data?.data?.total === 'number' && !Number.isNaN(data.data.total))
          ? data.data.total
          : 0;

    return direct || 0;
  }, [data, chartData]);

  // ✅ Estadísticas adicionales
  const stats = useMemo(() => {
    if (!chartData.length) return { promedio: 0, maximo: 0, diasConVentas: 0 };

    const valores = chartData.map(d => d.qty);
    const conVentas = valores.filter(v => v > 0);

    return {
      promedio: totalFooter / chartData.length,
      maximo: Math.max(...valores),
      diasConVentas: conVentas.length,
    };
  }, [chartData, totalFooter]);

  // ✅ Formatear fecha para el eje X (adaptativo según cantidad de días)
  const formatXAxis = (dateStr) => {
    try {
      const date = parseISO(dateStr);
      // Si hay más de 180 días, mostrar solo mes/año
      if (chartData.length > 180) {
        return format(date, 'MM/yy', { locale: es });
      }
      // Si hay más de 90 días, mostrar día/mes
      if (chartData.length > 90) {
        return format(date, 'dd/MM', { locale: es });
      }
      // Para rangos cortos, mostrar día/mes
      return format(date, 'dd/MM', { locale: es });
    } catch {
      return dateStr.slice(5, 10); // MM-DD fallback
    }
  };

  // ✅ Tooltip personalizado más claro (con colores del tema)
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <div style={{
        background: 'white',
        border: `1px solid ${themeColors.primary}`,
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {format(parseISO(data.label), "EEEE d 'de' MMMM", { locale: es })}
        </Typography>
        <Typography variant="body2" sx={{ color: themeColors.primary }}>
          📊 Ventas del día: <strong>{data.qty}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          📈 Acumulado: <strong>{data.acumulado}</strong>
        </Typography>
      </div>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TrendingUpIcon sx={{ color: themeColors.primary }} />
          <span>Análisis de ventas — {articuloNombre || 'Artículo'}</span>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Encabezado con rango y estadísticas */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Typography variant="body2" color="text.secondary">
              📅 Período: {format(new Date(rango.from), 'dd/MM/yyyy')} — {format(new Date(rango.to), 'dd/MM/yyyy')}
              {' '}({chartData.length} días)
            </Typography>

            <Stack direction="row" spacing={1}>
              <Chip
                size="small"
                label={`Promedio: ${stats.promedio.toFixed(1)}/día`}
                sx={{
                  bgcolor: `${themeColors.primary}20`,
                  color: themeColors.primary,
                  borderColor: themeColors.primary
                }}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`Pico: ${stats.maximo}`}
                sx={{
                  bgcolor: `${themeColors.secondary}20`,
                  color: themeColors.secondary,
                  borderColor: themeColors.secondary
                }}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`${stats.diasConVentas} días con ventas`}
                variant="outlined"
              />
            </Stack>
          </Stack>

          {/* Advertencia para rangos muy largos */}
          {chartData.length > 365 && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                bgcolor: `${themeColors.primary}10`,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: `${themeColors.primary}40`
              }}
            >
              <Typography variant="body2" sx={{ color: themeColors.primary }}>
                ℹ️ <strong>Rango amplio:</strong> Mostrando {chartData.length} días de datos.
                El gráfico se ha optimizado para esta cantidad de información.
              </Typography>
            </Stack>
          )}

          {/* Gráfico */}
          <div style={{
            width: '100%',
            height: chartData.length > 365 ? 400 : 340
          }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tickFormatter={formatXAxis}
                  tick={{ fontSize: 11 }}
                  interval={chartData.length > 180 ? 'preserveStartEnd' : 'preserveEnd'}
                  minTickGap={chartData.length > 365 ? 50 : 30}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10 }}
                  formatter={(value) => {
                    if (value === 'qty') return '📊 Ventas diarias';
                    if (value === 'acumulado') return '📈 Ventas acumuladas';
                    return value;
                  }}
                />
                <Bar
                  dataKey="qty"
                  fill={themeColors.primary}
                  name="qty"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="acumulado"
                  stroke={themeColors.secondary}
                  strokeWidth={2.5}
                  name="acumulado"
                  dot={{ r: 3, fill: themeColors.secondary }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de detalle */}
          <div>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              📋 Detalle diario
            </Typography>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Ventas del día</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Acumulado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {chartData.map((d) => (
                    <TableRow
                      key={d.label}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        bgcolor: d.qty > 0 ? 'inherit' : 'action.disabledBackground'
                      }}
                    >
                      <TableCell>
                        {format(parseISO(d.label), "EEE dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: d.qty > 0 ? 600 : 400 }}>
                        {d.qty}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: themeColors.secondary,
                          fontWeight: 500
                        }}
                      >
                        {d.acumulado}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && chartData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Sin datos en el rango seleccionado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
          <Typography variant="body1" sx={{ flex: 1, fontWeight: 600 }}>
            Total del período: <span style={{ color: themeColors.primary, fontSize: '1.1rem' }}>{totalFooter}</span> unidades
          </Typography>
          <Button
            onClick={onClose}
            variant="contained"
            size="large"
            sx={{
              bgcolor: themeColors.primary,
              '&:hover': {
                bgcolor: themeColors.primary,
                filter: 'brightness(0.9)'
              }
            }}
          >
            Cerrar
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}