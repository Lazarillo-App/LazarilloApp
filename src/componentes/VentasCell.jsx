// VentasCell.jsx (solo dif: sin auto-fetch en useEffect)
import React, { useMemo, useState } from 'react';
import { obtenerVentas } from '../servicios/apiVentas';
import VentasMiniGraficoModal from './VentasMiniGraficoModal';
import { IconButton, Tooltip, Stack, CircularProgress, Typography } from '@mui/material';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';

const cache = new Map();

export default function VentasCell({
  articuloId,
  articuloNombre,
  from,
  to,
  defaultGroupBy = 'day',
  totalOverride,                 // ← pasa este desde el padre (ventasMap)
}) {
  const [groupBy, setGroupBy] = useState(defaultGroupBy);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, items: [] });
  const [openModal, setOpenModal] = useState(false);

  const totalToShow = Number(totalOverride ?? 0);

  const cacheKey = useMemo(
    () => `${articuloId}|${from}|${to}|${groupBy}`,
    [articuloId, from, to, groupBy]
  );

  async function fetchVentas() {
    if (!articuloId || !from || !to) return;
    if (cache.has(cacheKey)) { setData(cache.get(cacheKey)); return; }
    setLoading(true);
    try {
      const res = await obtenerVentas({ articuloId, from, to, groupBy, ignoreZero: true });
      cache.set(cacheKey, res);
      setData(res);
    } finally {
      setLoading(false);
    }
  }

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
        <IconButton size="small" onClick={async () => { setOpenModal(true); await fetchVentas(); }}>
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
