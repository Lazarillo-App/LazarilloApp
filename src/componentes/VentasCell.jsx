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

export default function VentasCell({
  articuloId,
  articuloNombre,
  from,                 // YYYY-MM-DD
  to,                   // YYYY-MM-DD
  defaultGroupBy = 'day',
  totalOverride,        // si viene, mostramos eso y NO auto-fetch
  onTotalChange,        // opcional: reportar total al padre
}) {
  const [groupBy, setGroupBy] = useState(defaultGroupBy);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, items: [] });
  const [openModal, setOpenModal] = useState(false);

  const totalToShow = Number.isFinite(Number(totalOverride))
    ? Number(totalOverride)
    : Number(data?.total ?? 0);

  // clave de cache
  const cacheKey = useMemo(
    () => `${articuloId}|${from}|${to}|${groupBy}`,
    [articuloId, from, to, groupBy]
  );

  // eleva total si no hay override
  useEffect(() => {
    if (typeof onTotalChange === 'function' && !Number.isFinite(Number(totalOverride))) {
      onTotalChange(articuloId, Number(data?.total ?? 0));
    }
  }, [data?.total, articuloId, onTotalChange, totalOverride]);

  async function fetchVentas(opts = {}) {
    if (!articuloId || !from || !to) { opts.done?.(); return; }

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

  // 👇 Auto-fetch al montar / cambiar rango si NO hay totalOverride
  useEffect(() => {
    if (!Number.isFinite(Number(totalOverride))) {
      fetchVentas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, totalOverride]);

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 120 }}>
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {totalToShow}
        </Typography>
      )}

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
          await fetchVentas();
        }}
      />
    </Stack>
  );
}