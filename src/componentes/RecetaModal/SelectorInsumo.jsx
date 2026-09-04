/* eslint-disable no-unused-vars */
// src/componentes/RecetaModal/SelectorInsumo.jsx
import { Box, Typography, Stack } from '@mui/material';
import { PRIMARY } from './helpers';

/* ════════════════════════════════════════
   SELECTOR PREVIO (4 opciones al abrir un insumo)
════════════════════════════════════════ */
export default function SelectorInsumo({ nombre, insumoId, onElegir }) {
  const opciones = [
    {
      id: 'merma', titulo: 'Merma', icono: '🔻', bg: '#fdeaea',
      desc: 'Registrá el desperdicio del insumo: peladura, cepillado, limpieza. Ajusta el costo real por unidad utilizable.'
    },
    {
      id: 'receta', titulo: 'Receta / Compras', icono: '📖', bg: '#e8f4e8',
      desc: 'Costeá el insumo por receta o por sus compras registradas.'
    },
    {
      id: 'equivalencias', titulo: 'Equivalencias', icono: '⚖️', bg: '#eaf1fb',
      desc: 'Definí medidas propias (cuchara, dip, unidad) para convertir a gramos o ml en las recetas.'
    },
    {
      id: 'reemplazar', titulo: 'Reemplazar', icono: '🔁', bg: '#f3eafb',
      desc: 'Sustituí este insumo por otro en todas las recetas donde aparece.'
    },
  ];
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={800} textAlign="center" sx={{ mb: 2.5 }}>
        ¿Qué querés configurar de este insumo?
      </Typography>
      <Stack spacing={1.5}>
        {opciones.map(o => (
          <Box key={o.id}
            onClick={() => onElegir(o.id)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 2,
              border: '1px solid', borderColor: 'divider', borderRadius: 2,
              px: 2, py: 1.75, cursor: 'pointer', transition: 'all .15s',
              '&:hover': { borderColor: PRIMARY, bgcolor: `${PRIMARY}05` },
            }}>
            <Box sx={{ width: 46, height: 46, borderRadius: 2, bgcolor: o.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {o.icono}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={800}>{o.titulo}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>{o.desc}</Typography>
            </Box>
            <Typography sx={{ color: 'text.disabled', fontSize: 18 }}>›</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
