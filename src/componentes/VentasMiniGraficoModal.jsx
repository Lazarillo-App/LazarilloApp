// src/componentes/VentasMiniGraficoModal.jsx
import React, { useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, ToggleButton, ToggleButtonGroup, Button, Typography,
  Table, TableHead, TableRow, TableCell, TableBody, Stack
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, addDays } from 'date-fns';

export default function VentasMiniGraficoModal({
  open, onClose, articuloNombre, rango, data,
  groupBy, onChangeGroupBy, loading
}) {
  const chartData = useMemo(() => {
    const items = Array.isArray(data?.items) ? data.items : [];

    if (groupBy !== 'day') {
      // Para week/month (cuando lo habilites), no completamos calendario.
      let acc = 0;
      return items.map((it, i) => {
        const qty = Number(it.qty || 0);
        acc += qty;
        return { idx: i + 1, label: it.label, qty, acc };
      });
    }

    // --- completar calendario día a día (YYYY-MM-DD) ---
    const map = new Map(items.map(it => [String(it.label), Number(it.qty || 0)]));
    const from = new Date(rango.from + 'T00:00:00Z');
    const to   = new Date(rango.to   + 'T00:00:00Z');

    const seq = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const label = d.toISOString().slice(0, 10);
      seq.push({ label, qty: map.get(label) || 0 });
    }

    let acc = 0;
    return seq.map((d, i) => {
      acc += d.qty;
      return { idx: i + 1, label: d.label, qty: d.qty, acc };
    });
  }, [data, groupBy, rango.from, rango.to]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Ventas — {articuloNombre || 'Artículo'}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="body2">
            Rango: {format(new Date(rango.from), 'dd/MM/yyyy')} — {format(new Date(rango.to), 'dd/MM/yyyy')}
          </Typography>
          <ToggleButtonGroup
            value={groupBy}
            exclusive
            onChange={(_, val) => val && onChangeGroupBy(val)}
            size="small"
          >
            <ToggleButton value="day">Día</ToggleButton>
            <ToggleButton value="week" disabled>Semana</ToggleButton>
            <ToggleButton value="month" disabled>Mes</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack spacing={2}>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qty" />
                <Line type="monotone" dataKey="acc" dot />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <Typography variant="subtitle2">Detalle ({groupBy})</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Período</TableCell>
                <TableCell align="right">Cantidad</TableCell>
                <TableCell align="right">Acumulado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {chartData.map((d) => (
                <TableRow key={d.label}>
                  <TableCell>{d.label}</TableCell>
                  <TableCell align="right">{d.qty}</TableCell>
                  <TableCell align="right">{d.acc}</TableCell>
                </TableRow>
              ))}
              {!loading && chartData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>Sin datos en el rango seleccionado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Typography sx={{ flex: 1, pl: 2 }} variant="body2">
          Total: <b>{data?.total ?? 0}</b>
        </Typography>
        <Button onClick={onClose} variant="contained">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
