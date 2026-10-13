// src/componentes/ComprasCell.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { IconButton, Tooltip, Stack, Typography, CircularProgress } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ComprasMiniDetalleModal from './ComprasMiniDetalleModal';
import { BASE } from '../servicios/apiBase';
import { BusinessesAPI } from '../servicios/apiBusinesses';

const fmtNum = (v, d = 2) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n === 0) return '-';
  return n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
};

/**
 * ComprasCell
 *
 * Props:
 *   insumoId      number  — id del insumo
 *   insumoNombre  string
 *   comprasEntry  object | undefined  — { cantidad, neto, iva, total, facturas }
 *   from          string  YYYY-MM-DD
 *   to            string  YYYY-MM-DD
 *   businessId    number  — negocio activo
 *   businesses    array   — todos los negocios de la org (para el selector en el modal)
 *   loading       bool    — comprasMap todavía cargando
 */
function ComprasCell({
  insumoId, insumoNombre, insumoUnidad = '',
  comprasEntry, from, to,
  businessId, businesses = [],
  loading = false,
}) {
  const [open,          setOpen]          = useState(false);
  const [detailItems,   setDetailItems]   = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [facturacionPorMes, setFacturacionPorMes] = useState(null);
  // Insumo activo dentro del modal — arranca en el de esta fila, pero puede
  // cambiar sin cerrar el modal (ranking "Top por gasto" → onCambiarInsumo).
  const [activeInsumo, setActiveInsumo] = useState(null);
  // Rango activo dentro del modal — arranca en el período de la fila (from/to
  // de la barra), pero el botón "📅 Fechas" del detalle puede pisarlo sin
  // cerrar el modal ni afectar el período del resto de la tabla.
  const [rangoOverride, setRangoOverride] = useState(null);

  const hasData = !!comprasEntry && (
    Number(comprasEntry.total ?? 0) !== 0 ||
    Number(comprasEntry.cantidad ?? 0) !== 0
  );

  const rangoEfectivo = useMemo(() => (
    rangoOverride || { from: from ? String(from).slice(0, 10) : null, to: to ? String(to).slice(0, 10) : null }
  ), [rangoOverride, from, to]);

  const fetchDetalle = useCallback(async (targetInsumoId, rangoArg) => {
    if (!targetInsumoId || !rangoArg?.from || !rangoArg?.to) return;
    setDetailLoading(true);
    setDetailItems([]);
    try {
      const token = localStorage.getItem('token');
      const bid   = businessId ?? localStorage.getItem('activeBusinessId') ?? '';
      const url = `${BASE}/purchases?insumo_id=${targetInsumoId}&from=${rangoArg.from}&to=${rangoArg.to}&limit=500`;
      const res = await fetch(url, {
        headers: {
          Authorization:   `Bearer ${token}`,
          'X-Business-Id': String(bid),
        },
      });
      const data = await res.json().catch(() => ({}));
      setDetailItems(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.warn('[ComprasCell] Error cargando detalle:', e.message);
      setDetailItems([]);
    } finally {
      setDetailLoading(false);
    }
  }, [businessId]);

  const handleOpen = useCallback(async () => {
    if (!insumoId || !from || !to) return;
    setOpen(true);
    setRangoOverride(null);
    setActiveInsumo({ id: insumoId, nombre: insumoNombre, unidad: insumoUnidad });
    const rangoInicial = { from: String(from).slice(0, 10), to: String(to).slice(0, 10) };
    fetchDetalle(insumoId, rangoInicial);

    // Facturación del negocio por mes, para el KPI "sobre facturación" del
    // modal — no depende del insumo activo, no hace falta repetirla al
    // cambiar de insumo dentro del mismo modal.
    try {
      const bid = businessId ?? localStorage.getItem('activeBusinessId') ?? '';
      const resp = await BusinessesAPI.salesMonthly(bid, rangoInicial);
      setFacturacionPorMes(resp?.porMes || null);
    } catch (e) {
      console.warn('[ComprasCell] Error cargando facturación por mes:', e.message);
      setFacturacionPorMes(null);
    }
  }, [insumoId, insumoNombre, insumoUnidad, from, to, businessId, fetchDetalle]);

  const cambiarInsumo = useCallback((item) => {
    if (!item?.id) return;
    setActiveInsumo({ id: Number(item.id), nombre: item.nombre, unidad: item.unidad_med || '' });
    fetchDetalle(item.id, rangoEfectivo);
  }, [fetchDetalle, rangoEfectivo]);

  const cambiarRango = useCallback((nuevoRango) => {
    if (!nuevoRango?.from || !nuevoRango?.to) return;
    setRangoOverride(nuevoRango);
    if (activeInsumo?.id) fetchDetalle(activeInsumo.id, nuevoRango);
    const bid = businessId ?? localStorage.getItem('activeBusinessId') ?? '';
    BusinessesAPI.salesMonthly(bid, nuevoRango)
      .then((resp) => setFacturacionPorMes(resp?.porMes || null))
      .catch(() => setFacturacionPorMes(null));
  }, [activeInsumo, fetchDetalle, businessId]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setDetailItems([]);
    setFacturacionPorMes(null);
    setActiveInsumo(null);
    setRangoOverride(null);
  }, []);

  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 90 }}>
        {loading ? (
          <CircularProgress size={12} sx={{ color: 'var(--color-primary, #0369a1)' }} />
        ) : (
          <Typography
            variant="body2"
            sx={{
              minWidth: 24,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              color: hasData ? 'var(--color-primary, #0369a1)' : '#94a3b8',
              fontWeight: hasData ? 700 : 400,
            }}
          >
            {hasData ? `$\u00a0${fmtNum(comprasEntry.total, 0)}` : '-'}
          </Typography>
        )}

        <Tooltip title={hasData ? 'Ver detalle de compras' : 'Sin compras en el período'}>
          <span>
            <IconButton
              size="small"
              onClick={handleOpen}
              disabled={!hasData || loading}
              sx={{
                color: hasData ? 'var(--color-primary, #0369a1)' : '#cbd5e1',
                p: '2px',
                '&:hover': {
                  bgcolor: 'color-mix(in srgb, var(--color-primary, #0369a1) 12%, transparent)',
                },
              }}
              aria-label="Ver detalle de compras"
            >
              <ReceiptLongIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {open && activeInsumo && (
        <ComprasMiniDetalleModal
          open={open}
          onClose={handleClose}
          insumoId={activeInsumo.id}
          insumoNombre={activeInsumo.nombre}
          insumoUnidad={activeInsumo.unidad}
          rango={rangoEfectivo}
          items={detailItems}
          loading={detailLoading}
          businessId={businessId}
          businesses={businesses}
          facturacionPorMes={facturacionPorMes}
          onCambiarInsumo={cambiarInsumo}
          onCambiarRango={cambiarRango}
        />
      )}
    </>
  );
}

export default React.memo(ComprasCell);