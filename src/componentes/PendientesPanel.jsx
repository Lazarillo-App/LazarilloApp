// src/componentes/PendientesPanel.jsx
// Pestaña "Pendientes" del sidebar. Staff: sus propios cambios y en qué estado están
// (en gris hasta que se aprueben). Admin/owner: propuestas abiertas para revisar.
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Stack, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAccess } from '@/context/AccessContext';
import { listarPropuestas, listarMisPropuestas } from '@/servicios/apiRecetaProposals';

const ESTADO = {
  pending: { label: 'Pendiente', color: '#9ca3af' },
  in_revision: { label: 'A revisión', color: '#b45309' },
  approved: { label: 'Aprobado', color: '#15803d' },
  rejected: { label: 'Rechazado', color: '#b91c1c' },
};

export default function PendientesPanel({ businessId }) {
  const { isStaff } = useAccess() || {};
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId) return undefined;
    let vivo = true;
    setLoading(true); setError('');
    (isStaff ? listarMisPropuestas(businessId) : listarPropuestas(businessId))
      .then((r) => { if (vivo) setItems(r); })
      .catch((e) => { if (vivo) setError(e.message || 'No se pudo cargar'); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [businessId, isStaff]);

  if (loading) return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={18} /></Box>;
  if (error) return <Typography variant="caption" color="error" sx={{ p: 1, display: 'block' }}>{error}</Typography>;
  if (!items.length) {
    return <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
      {isStaff ? 'No tenés cambios enviados.' : 'No hay propuestas para revisar.'}
    </Typography>;
  }

  return (
    <Stack spacing={0.75} sx={{ p: 0.5 }}>
      {items.map((p) => {
        const est = ESTADO[p.status] || ESTADO.pending;
        const esGris = isStaff && (p.status === 'pending' || p.status === 'in_revision');
        const nombre = p.receta_nombre_actual
          || (p.insumo_id ? `Insumo #${p.insumo_id}` : `Artículo #${p.article_id}`);
        return (
          <Box key={p.id} onClick={() => { if (!isStaff) navigate('/configuracion?tab=6'); }}
            sx={{
              p: 1, borderRadius: 1.5, border: '1px solid #e2e8f0',
              bgcolor: esGris ? '#f3f4f6' : '#fff', color: esGris ? '#9ca3af' : 'inherit',
              cursor: isStaff ? 'default' : 'pointer', '&:hover': { borderColor: '#94a3b8' },
            }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nombre}
              </Typography>
              <Chip size="small" label={est.label} sx={{ height: 20, fontSize: '0.68rem', color: est.color, borderColor: est.color }} variant="outlined" />
            </Stack>
            {p.admin_comment && (
              <Typography sx={{ fontSize: '0.72rem', mt: 0.5, color: 'text.secondary' }}>“{p.admin_comment}”</Typography>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
