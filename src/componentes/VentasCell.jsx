/* eslint-disable no-unused-vars */
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

  // 👉 ¿Tenemos total ya calculado por el padre?
  const hasOverride =
    totalOverride != null && !Number.isNaN(Number(totalOverride));

  // ✅ Solo traemos la serie CUANDO el modal está abierto
  const shouldFetchSeries =
    !!articuloId && !!from && !!to && openModal;

  const { data, isLoading } = useVentasSeries({
    articuloId,
    from,
    to,
    groupBy,
    enabled: shouldFetchSeries,
  });

  // 🔍 Total calculado desde la serie (para el modal / fallback) - unidades
  const totalFromSeries = useMemo(() => {
    if (!data) return 0;

    if (typeof data.total === 'number' && !Number.isNaN(data.total)) {
      return data.total;
    }

    if (data.data && typeof data.data.total === 'number') {
      return data.data.total;
    }

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

  // 🔍 Monto calculado desde la serie (para pasar amount al padre)
  const amountFromSeries = useMemo(() => {
    if (!data) return 0;

    if (typeof data.amount === 'number' && !Number.isNaN(data.amount)) {
      return data.amount;
    }

    if (data.data && typeof data.data.total_amount === 'number') {
      return data.data.total_amount;
    }

    const items =
      (Array.isArray(data.items) && data.items) ||
      (Array.isArray(data.series) && data.series) ||
      (Array.isArray(data.data?.items) && data.data.items) ||
      [];

    const sum = items.reduce((acc, it) => {
      const v = Number(
        it.amount ??
          it.importe ??
          it.total ??
          it.total_amount ??
          it.venta_monto ??
          0
      );
      return acc + (Number.isNaN(v) ? 0 : v);
    }, 0);

    return sum;
  }, [data]);

  // 🔁 Solo avisamos al padre si NO hay override y sí hay serie (normalmente en el modal)
  useEffect(() => {
    if (
      !hasOverride &&
      typeof onTotalResolved === 'function' &&
      articuloId &&
      !Number.isNaN(Number(totalFromSeries))
    ) {
      try {
        const idNum = Number(articuloId);
        const qtyNum = Number(totalFromSeries || 0);
        const amountNum = Number(amountFromSeries || 0);

        onTotalResolved(idNum, { qty: Number.isFinite(qtyNum) ? qtyNum : 0, amount: Number.isFinite(amountNum) ? amountNum : 0 });
      } catch (e) {
        // no rompemos la UI por un fallo al notificar
        // console.error('VentasCell.onTotalResolved error', e);
      }
    }
  }, [hasOverride, articuloId, totalFromSeries, amountFromSeries, onTotalResolved]);

  // 🔢 Qué número mostramos en la celda de la tabla
  const totalToShow = hasOverride
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
      {/* En la tabla nunca bloqueamos por loading: usamos el número que ya tenemos */}
      <Typography
        variant="body2"
        sx={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
        title={String(totalToShow)}
      >
        {totalToShow}
      </Typography>

      <Tooltip title="Ver gráfico">
        <IconButton
          size="small"
          onClick={handleOpenModal}
          aria-label="Ver gráfico de ventas"
        >
          {isLoading && openModal ? (
            <CircularProgress size={16} />
          ) : (
            <InsertChartOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <VentasMiniGraficoModal
        open={openModal}
        onClose={handleCloseModal}
        articuloNombre={articuloNombre}
        rango={{ from, to }}
        data={data || { total: totalToShow, items: [] }}
        loading={isLoading}
        groupBy={groupBy}
        onChangeGroupBy={(gb) => {
          if (!gb || gb === groupBy) return;
          setGroupBy(gb);
        }}
      />
    </Stack>
  );
}

export default React.memo(VentasCell);
