// src/componentes/RecetaModal/TabUsoInsumo.jsx
import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { insumoUsoList } from '@/servicios/apiInsumos';
import { PRIMARY } from './helpers';

/* ════════════════════════════════════════
   TAB USO — recetas donde se usa el insumo (solo lectura)
════════════════════════════════════════ */
export default function TabUsoInsumo({ insumoId, businessId, insumoData }) {
  const [uso, setUso] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!insumoId || !businessId) return;
    setLoading(true);
    insumoUsoList(insumoId, businessId)
      .then(r => setUso(Array.isArray(r?.uso) ? r.uso : []))
      .catch(() => setUso([]))
      .finally(() => setLoading(false));
  }, [insumoId, businessId]);

  const unidadBase = insumoData?.unidad_med || insumoData?.medida || 'u';

  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Recetas donde se usa <b>{insumoData?.nombre || 'este insumo'}</b>
        {uso.length > 0 && ` · ${uso.length} ${uso.length === 1 ? 'receta' : 'recetas'}`}
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : uso.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled' }}>
          <Typography variant="body2">Este insumo no se usa en ninguna receta todavía.</Typography>
        </Box>
      ) : (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: '90px 1fr 130px 140px', gap: 1,
            px: 1.5, py: 1, bgcolor: `${PRIMARY}0d`, borderBottom: '1px solid', borderColor: 'divider',
            fontWeight: 700, fontSize: '0.75rem', color: PRIMARY,
          }}>
            <div>Código art.</div>
            <div>Nombre</div>
            <div style={{ textAlign: 'right' }}>Cantidad</div>
            <div>Merma</div>
          </Box>
          {/* Filas */}
          {uso.map((u, i) => (
            <Box key={u.item_id ?? i} sx={{
              display: 'grid', gridTemplateColumns: '90px 1fr 130px 140px', gap: 1,
              px: 1.5, py: 1, alignItems: 'center',
              borderBottom: i < uso.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
              fontSize: '0.82rem',
              '&:hover': { bgcolor: '#f8fafc' },
            }}>
              <div style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                {u.codigo || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                {u.es_elaborado && (
                  <span title="Insumo elaborado" style={{ color: '#6366f1', fontSize: '0.7rem', flexShrink: 0 }}>●</span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.nombre}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {Number(u.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {u.unidad || unidadBase}
              </div>
              <div style={{ color: u.aplica_merma ? '#0891b2' : '#94a3b8', fontSize: '0.78rem' }}>
                {u.merma_nombre
                  ? u.merma_nombre
                  : (u.aplica_merma ? 'Sí (global)' : 'No')}
              </div>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
