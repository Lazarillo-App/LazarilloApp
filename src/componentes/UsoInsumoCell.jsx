// src/componentes/UsoInsumoCell.jsx
// Celda "Uso" de la tabla de Insumos: muestra la cantidad de recetas donde
// aparece el insumo (elaborado o no). Al pasar el mouse, trae (lazy) las
// primeras 5 ordenadas por venta del artículo — si son pocas, alcanza con el
// tooltip sin abrir el modal. Al hacer click, abre el modal directo en la
// pestaña "Uso".
import React, { useState, useRef, useCallback } from 'react';
import { Tooltip, CircularProgress, Box, Typography } from '@mui/material';
import { insumoUsoResumen } from '@/servicios/apiInsumos';

const fmtCurrency = (v) => {
  try {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(v || '');
  }
};

export default function UsoInsumoCell({ n, insumoId, businessId, onOpenUso }) {
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const cargar = useCallback(() => {
    if (fetchedRef.current || !insumoId || !(n > 0)) return;
    fetchedRef.current = true;
    setLoading(true);
    insumoUsoResumen(insumoId, businessId, { limit: 5 })
      .then((r) => setResumen(r))
      .catch(() => setResumen({ items: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [insumoId, businessId, n]);

  if (!(n > 0)) {
    return <span style={{ color: '#94a3b8' }}>—</span>;
  }

  const tooltipContent = (loading || !resumen) ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5 }}>
      <CircularProgress size={12} sx={{ color: '#fff' }} /> Cargando…
    </Box>
  ) : (
    <Box sx={{ p: 0.5, maxWidth: 260 }}>
      {resumen.items.map((it) => (
        <Typography key={it.receta_id} variant="caption" sx={{ display: 'block', lineHeight: 1.6 }}>
          {it.nombre}{it.ventas_amount > 0 ? ` — ${fmtCurrency(it.ventas_amount)}` : ''}
        </Typography>
      ))}
      {resumen.total > resumen.items.length && (
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, mt: 0.5 }}>
          +{resumen.total - resumen.items.length} más — click para ver todas
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} onOpen={cargar} placement="top" arrow enterDelay={300}>
      <span
        onClick={() => onOpenUso?.()}
        style={{
          fontWeight: 600, cursor: 'pointer', color: 'var(--color-primary)',
          textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
        }}
      >
        {n}
      </span>
    </Tooltip>
  );
}
