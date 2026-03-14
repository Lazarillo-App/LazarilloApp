// src/componentes/ComprasCell.jsx
import React, { useState, useCallback } from 'react';
import { IconButton, Tooltip, Stack, Typography, CircularProgress } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ComprasMiniDetalleModal from './ComprasMiniDetalleModal';
import { BASE } from '../servicios/apiBase';

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
 *   comprasEntry  object | undefined  — entrada del comprasMap: { cantidad, neto, iva, total, facturas }
 *   from          string  YYYY-MM-DD
 *   to            string  YYYY-MM-DD
 *   businessId    number  — negocio activo (para la query de detalle)
 *   loading       bool    — comprasMap todavía cargando
 *
 * Usa las CSS variables --color-primary y --on-primary del ThemeProviderNegocio
 * para que la columna tome el color del negocio activo automáticamente.
 */
function ComprasCell({ insumoId, insumoNombre, comprasEntry, from, to, businessId, loading = false }) {
  const [open,          setOpen]          = useState(false);
  const [detailItems,   setDetailItems]   = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const hasData = !!comprasEntry && (
    Number(comprasEntry.total ?? 0) !== 0 ||
    Number(comprasEntry.cantidad ?? 0) !== 0
  );

  const handleOpen = useCallback(async () => {
    if (!insumoId || !from || !to) return;
    setOpen(true);
    setDetailLoading(true);
    setDetailItems([]);

    try {
      const token = localStorage.getItem('token');
      const bid   = businessId ?? localStorage.getItem('activeBusinessId') ?? '';
      const url   = `${BASE}/purchases?insumo_id=${insumoId}&from=${from}&to=${to}&limit=500`;
      const res   = await fetch(url, {
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
  }, [insumoId, from, to, businessId]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setDetailItems([]);
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
            {hasData ? fmtNum(comprasEntry.total, 0) : '-'}
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

      {open && (
        <ComprasMiniDetalleModal
          open={open}
          onClose={handleClose}
          insumoNombre={insumoNombre}
          rango={{ from, to }}
          items={detailItems}
          loading={detailLoading}
        />
      )}
    </>
  );
}

export default React.memo(ComprasCell);