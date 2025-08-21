// src/componentes/VentasCell.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { obtenerVentas } from '../servicios/apiVentas';
import VentasMiniGraficoModal from './VentasMiniGraficoModal';
import {
  IconButton,
  Tooltip,
  Popover,
  Box,
  Stack,
  TextField,
  Button,
  CircularProgress,
  Typography
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';

// Cache en memoria: `${articuloId}|${from}|${to}|${groupBy}` -> { total, items }
const cache = new Map();

export default function VentasCell({
  articuloId,
  articuloNombre,
  onTotalChange, // opcional: para ordenar por ventas desde el padre
}) {
  // últimos 30 días por defecto
  const [from, setFrom] = useState(() => toISO(-30));
  const [to, setTo] = useState(() => toISO(0));
  const [groupBy, setGroupBy] = useState('day'); // 'day'|'week'|'month'

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, items: [] });

  const [anchorEl, setAnchorEl] = useState(null); // popover calendario
  const [openModal, setOpenModal] = useState(false);

  // Elevar total al padre para sort
  useEffect(() => {
    if (typeof onTotalChange === 'function') {
      onTotalChange(articuloId, Number(data?.total ?? 0));
    }
  }, [data?.total, articuloId, onTotalChange]);

  const cacheKey = useMemo(
    () => `${articuloId}|${from}|${to}|${groupBy}`,
    [articuloId, from, to, groupBy]
  );

  async function fetchVentas(opts = {}) {
  const gb = opts.groupBy ?? groupBy;

  // si el agrupador no cambia, usamos el cacheKey memoizado
  const key = gb === groupBy ? cacheKey : `${articuloId}|${from}|${to}|${gb}`;

  if (cache.has(key)) {
    setData(cache.get(key));
    if (opts.done) opts.done();
    return;
  }

  setLoading(true);
  try {
    const res = await obtenerVentas({ articuloId, from, to, groupBy: gb });
    cache.set(key, res);
    setData(res);
  } finally {
    setLoading(false);
    if (opts.done) opts.done();
  }
}

  function handleOpenPicker(e) {
    setAnchorEl(e.currentTarget);
  }
  function handleClosePicker() {
    setAnchorEl(null);
  }
  const pickerOpen = Boolean(anchorEl);

  function applyRange() {
  if (new Date(from) > new Date(to)) return; // opcional: mostrar snackbar
  fetchVentas({ done: handleClosePicker });
}
  // Presets rápidos
  function setPreset(days) {
    setFrom(toISO(-days));
    setTo(toISO(0));
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 120 }}>
      {/* Calendario: abre popover de rango */}
      <Tooltip title="Elegir rango">
        <IconButton size="small" onClick={handleOpenPicker}>
          <CalendarMonthIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Total */}
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {data?.total ?? 0}
        </Typography>
      )}

      {/* Modal gráfico */}
      <Tooltip title="Ver gráfico">
        <IconButton
          size="small"
          onClick={() => {
            setOpenModal(true);
            if (!data?.items?.length) fetchVentas();
          }}
        >
          <InsertChartOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Popover con rango de fechas */}
      <Popover
        open={pickerOpen}
        onClose={handleClosePicker}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 260 }}>
          <Stack spacing={1.2}>
            <TextField
              label="Desde"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Hasta"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => setPreset(7)}>7d</Button>
              <Button variant="outlined" size="small" onClick={() => setPreset(30)}>30d</Button>
              <Button variant="outlined" size="small" onClick={() => setPreset(90)}>90d</Button>
            </Stack>

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button onClick={handleClosePicker} size="small">Cancelar</Button>
              <Button onClick={applyRange} variant="contained" size="small">Aplicar</Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>

      {/* Modal MUI + Recharts */}
      <VentasMiniGraficoModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        articuloNombre={articuloNombre}
        rango={{ from, to }}
        data={data}
        loading={loading}
        groupBy={groupBy}
        onChangeGroupBy={async (gb) => {
          setGroupBy(gb);
          await fetchVentas({ groupBy: gb });
        }}
      />
    </Stack>
  );
}

/** Util: YYYY-MM-DD con delta de días respecto a hoy */
function toISO(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
