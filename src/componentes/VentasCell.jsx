// src/componentes/VentasCell.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { IconButton, Tooltip, Stack, CircularProgress, Typography } from '@mui/material';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import VentasMiniGraficoModal from './VentasMiniGraficoModal';
import { useVentasSeries } from '../hooks/useVentasSeries';

function VentasCell({
  articuloId,
  articuloNombre,
  from,
  to,
  defaultGroupBy = 'day',
  totalOverride,
  onTotalResolved,
}) {
  const [groupBy, setGroupBy] = useState(defaultGroupBy);
  const [openModal, setOpenModal] = useState(false);

  // 🔁 Siempre traemos la serie mientras haya datos mínimos
  const {
    data,
    isLoading,
  } = useVentasSeries({
    articuloId,
    from,
    to,
    groupBy,
    enabled: !!articuloId && !!from && !!to,
  });

  // 🔍 Total calculado de forma robusta
  const totalFromSeries = useMemo(() => {
    if (!data) return 0;

    // 1) Si el backend ya manda un total numérico, lo usamos directo
    if (typeof data.total === 'number' && !Number.isNaN(data.total)) {
      return data.total;
    }

    // 2) Si viene algo tipo { data: { total, items } }
    if (data.data && typeof data.data.total === 'number') {
      return data.data.total;
    }

    // 3) Sumamos items (formas comunes: qty, cantidad, unidades, total_u)
    const items =
      (Array.isArray(data.items) && data.items) ||
      (Array.isArray(data.series) && data.series) ||
      (Array.isArray(data.data?.items) && data.data.items) ||
      [];

    const sum = items.reduce((acc, it) => {
      const v = Number(
        it.qty ??
        it.cantidad ??
        it.unidades ??
        it.total_u ??
        0
      );
      return acc + (Number.isNaN(v) ? 0 : v);
    }, 0);

    return sum;
  }, [data]);

  // Si el padre quiere enterarse del total, se lo informamos cuando cambie
  useEffect(() => {
    if (
      typeof onTotalResolved === 'function' &&
      articuloId &&
      !Number.isNaN(totalFromSeries)
    ) {
      onTotalResolved(articuloId, totalFromSeries);
    }
  }, [articuloId, totalFromSeries, onTotalResolved]);

  // Qué número mostramos en la celda
  const totalToShow =
    totalOverride != null && !Number.isNaN(Number(totalOverride))
      ? Number(totalOverride)
      : totalFromSeries;

  const handleOpenModal = () => {
    if (!articuloId || !from || !to) return;
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 120 }}>
      {isLoading && openModal ? (
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
          onClick={handleOpenModal}
          aria-label="Ver gráfico de ventas"
        >
          <InsertChartOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <VentasMiniGraficoModal
        open={openModal}
        onClose={handleCloseModal}
        articuloNombre={articuloNombre}
        rango={{ from, to }}
        data={data || { total: 0, items: [] }}
        loading={isLoading}
        groupBy={groupBy}
        onChangeGroupBy={(gb) => {
          if (!gb || gb === groupBy) return;
          setGroupBy(gb); // el hook se re-dispara solo porque groupBy cambia
        }}
      />
    </Stack>
  );
}

export default React.memo(VentasCell);
