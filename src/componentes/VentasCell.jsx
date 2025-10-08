// src/componentes/VentasCell.jsx
import React, { useMemo, useState } from 'react';
import { IconButton, Tooltip, Stack, CircularProgress, Typography } from '@mui/material';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import VentasMiniGraficoModal from './VentasMiniGraficoModal';
import { obtenerVentas } from '../servicios/apiVentas';

export default function VentasCell({
  articuloId,
  articuloNombre,
  from,
  to,
  defaultGroupBy = 'day',
  totalOverride,
}) {
  const [groupBy, setGroupBy] = useState(defaultGroupBy);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ total: 0, items: [] });
  const [openModal, setOpenModal] = useState(false);

  const activeBizId = localStorage.getItem('activeBusinessId');
  const totalToShow = Number(totalOverride ?? 0);

  // eslint-disable-next-line no-unused-vars
  const cacheKey = useMemo(
    () => `${activeBizId}|${articuloId}|${from}|${to}|${groupBy}`,
    [activeBizId, articuloId, from, to, groupBy]
  );

  async function fetchVentas(nextGroupBy) {
    if (!activeBizId || !articuloId || !from || !to) return;
    const gb = nextGroupBy || groupBy;
    setLoading(true);
    try {
      const res = await obtenerVentas({
        articuloId,
        from,
        to,
        groupBy: gb,        // hoy sólo 'day', pero dejamos el prop
        ignoreZero: false,  // que venga el rango completo
      });
      setData(res);
    } catch (e) {
      console.error('fetchVentas error', e);
      setData({ total: 0, items: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 120 }}>
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        <Typography
          variant="body2"
          sx={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          title={String(totalToShow)}
        >
          {totalToShow}
        </Typography>
      )}

      <Tooltip title="Ver gráfico">
        <IconButton
          size="small"
          onClick={async () => {
            setOpenModal(true);
            await fetchVentas();
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
          await fetchVentas(gb);
        }}
      />
    </Stack>
  );
}
