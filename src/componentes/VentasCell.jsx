// src/componentes/VentasCell.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, Tooltip, Stack, CircularProgress, Typography } from '@mui/material';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import VentasMiniGraficoModal from './VentasMiniGraficoModal';
import { useVentasSeries } from '../hooks/useVentasSeries';

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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

  const hasOverride =
    totalOverride != null && !Number.isNaN(Number(totalOverride));

  // Solo traemos la serie CUANDO el modal está abierto
  const shouldFetchSeries =
    !!articuloId && !!from && !!to && openModal;

  const { data, isLoading } = useVentasSeries({
    articuloId,
    from,
    to,
    groupBy,
    enabled: shouldFetchSeries,
  });

  const seriesItems = useMemo(() => {
    return (
      (Array.isArray(data?.items) && data.items) ||
      (Array.isArray(data?.series) && data.series) ||
      (Array.isArray(data?.data?.items) && data.data.items) ||
      (Array.isArray(data?.data?.series) && data.data.series) ||
      []
    );
  }, [data]);

  const totalFromSeries = useMemo(() => {
    if (!data) return 0;

    const direct =
      (typeof data.total === 'number' && !Number.isNaN(data.total)) ? data.total
      : (typeof data?.data?.total === 'number' && !Number.isNaN(data.data.total)) ? data.data.total
      : null;

    if (direct != null) return toNum(direct);

    return seriesItems.reduce((acc, it) => {
      const v = toNum(
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
      return acc + v;
    }, 0);
  }, [data, seriesItems]);

  const amountFromSeries = useMemo(() => {
    if (!data) return 0;

    const direct =
      (typeof data.amount === 'number' && !Number.isNaN(data.amount)) ? data.amount
      : (typeof data?.data?.total_amount === 'number' && !Number.isNaN(data.data.total_amount)) ? data.data.total_amount
      : null;

    if (direct != null) return toNum(direct);

    return seriesItems.reduce((acc, it) => {
      const v = toNum(
        it.calcAmount ??
        it.amount ??
        it.amountMap ??
        it.importe ??
        it.total ??
        it.total_amount ??
        it.venta_monto ??
        0
      );
      return acc + v;
    }, 0);
  }, [data, seriesItems]);

  // Ref para recordar el último valor reportado al padre.
  // Evita llamar onTotalResolved en cada re-render causado por el padre.
  const lastReportedRef = useRef(null);

  useEffect(() => {
    // Solo reportar cuando el modal se cierra Y hay datos de la serie
    if (openModal) return;
    if (!data) return;
    if (typeof onTotalResolved !== 'function') return;
    if (!articuloId) return;

    const idNum = Number(articuloId);
    if (!Number.isFinite(idNum)) return;

    const qtyNum = toNum(totalFromSeries);
    const amountNum = toNum(amountFromSeries);

    // Si ambos son 0 no hay nada nuevo que reportar
    if (qtyNum === 0 && amountNum === 0) return;

    // No llamar si ya reportamos exactamente estos valores (evita el loop)
    const last = lastReportedRef.current;
    if (last && last.qty === qtyNum && last.amount === amountNum) return;

    lastReportedRef.current = { qty: qtyNum, amount: amountNum };

    try {
      onTotalResolved(idNum, { qty: qtyNum, amount: amountNum });
    } catch (e) {
      console.warn('[VentasCell] Error en onTotalResolved:', e);
    }
  }, [
    openModal,
    data,
    articuloId,
    totalFromSeries,
    amountFromSeries,
    onTotalResolved,
  ]);

  // Qué número mostramos en la celda de la tabla
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