// src/componentes/VentasCell.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { obtenerVentas } from '../servicios/apiVentas';
import VentasMiniGraficoModal from './VentasMiniGraficoModal';
import {
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Typography
} from '@mui/material';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';

// Cache en memoria: `${articuloId}|${from}|${to}|${groupBy}` -> { total, items }
const cache = new Map();

/**
 * VentasCell (refactor)
 * - No tiene calendario propio.
 * - Usa from/to provistos por el contenedor (global).
 * - Muestra el total pasado por props (totalOverride) o, si no hay, el de la serie cuando se cargue.
 */
export default function VentasCell({
  articuloId,
  articuloNombre,
  from,             // YYYY-MM-DD (global)
  to,               // YYYY-MM-DD (global)
  defaultGroupBy = 'day', // 'day'|'week'|'month'
  totalOverride,    // opcional: número (ej. del Map de ventas por agrupación)
  onTotalChange,    // opcional: para ordenar por ventas desde el padre
}) {
  const [groupBy, setGroupBy] = useState(defaultGroupBy);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, items: [] });
  const [openModal, setOpenModal] = useState(false);

  // Total que se muestra en la celda:
  const totalToShow = Number.isFinite(Number(totalOverride))
    ? Number(totalOverride)
    : Number(data?.total ?? 0);

  // Elevar total al padre solo si no tenemos override
  useEffect(() => {
    if (typeof onTotalChange === 'function' && !Number.isFinite(Number(totalOverride))) {
      onTotalChange(articuloId, Number(data?.total ?? 0));
    }
  }, [data?.total, articuloId, onTotalChange, totalOverride]);

  const cacheKey = useMemo(
    () => `${articuloId}|${from}|${to}|${groupBy}`,
    [articuloId, from, to, groupBy]
  );

  async function fetchVentas(opts = {}) {
    // Si ya está cacheado con el groupBy actual, usamos cache
    if (cache.has(cacheKey)) {
      setData(cache.get(cacheKey));
      opts.done?.();
      return;
    }
    setLoading(true);
    try {
      const res = await obtenerVentas({ articuloId, from, to, groupBy });
      cache.set(cacheKey, res);
      setData(res);
    } finally {
      setLoading(false);
      opts.done?.();
    }
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 120 }}>
      {/* Total */}
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {totalToShow}
        </Typography>
      )}

      {/* Modal gráfico */}
      <Tooltip title="Ver gráfico">
        <IconButton
          size="small"
          onClick={() => {
            setOpenModal(true);
            // si no hay serie, traemos
            if (!data?.items?.length) fetchVentas();
          }}
        >
          <InsertChartOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

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
          if (!gb || gb === groupBy) return;
          setGroupBy(gb);
          // Al cambiar agrupador, pedimos nuevamente
          await fetchVentas();
        }}
      />
    </Stack>
  );
}
