/* eslint-disable no-empty */
// src/componentes/RecetaModal/CostoPreferidoSelector.jsx
import { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { insumoUpdate } from '@/servicios/apiInsumos';
import { PRIMARY } from './helpers';

/* ════════════════════════════════════════
   SELECTOR DE COSTO PREFERIDO DEL INSUMO
   costo_preferido: null=auto (gana el más reciente por fecha) | 'compra' | 'elaboracion'
════════════════════════════════════════ */
export default function CostoPreferidoSelector({ insumoId, businessId, costoPreferido, origenEfectivo, variant = 'switch', onChanged }) {
  const [valor, setValor] = useState(costoPreferido ?? 'auto'); // 'auto' | 'compra' | 'elaboracion'
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setValor(costoPreferido ?? 'auto'); }, [costoPreferido]);

  const guardar = async (nuevo) => {
    setValor(nuevo);
    setGuardando(true);
    try {
      await insumoUpdate(insumoId, {
        costoPreferido: nuevo === 'auto' ? null : nuevo,
      }, businessId);
      onChanged?.(nuevo === 'auto' ? null : nuevo);
      // Avisar a otros montajes del selector (popup ↔ cabeceras) para que se sincronicen
      try {
        window.dispatchEvent(new CustomEvent('insumo:costo-preferido-changed', {
          detail: { insumoId, costoPreferido: nuevo === 'auto' ? null : nuevo },
        }));
      } catch { }
      setAbierto(false);
    } catch (e) {
      console.error('[CostoPreferidoSelector]', e.message);
    } finally {
      setGuardando(false);
    }
  };

  // Texto del costo activo (para el aviso)
  const activoTxt = origenEfectivo === 'compra' ? 'última compra' : 'receta';
  const esAuto = valor === 'auto';

  const chips = (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {[
        { v: 'auto', label: 'Automático' },
        { v: 'compra', label: 'Compra' },
        { v: 'elaboracion', label: 'Receta' },
      ].map(opt => (
        <Chip
          key={opt.v}
          label={opt.label}
          size="small"
          disabled={guardando}
          onClick={() => guardar(opt.v)}
          color={valor === opt.v ? 'primary' : 'default'}
          variant={valor === opt.v ? 'filled' : 'outlined'}
          sx={{ fontSize: '0.72rem', height: 24, cursor: 'pointer' }}
        />
      ))}
    </Box>
  );

  if (variant === 'switch') {
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
          ¿Qué costo usar para este insumo en las recetas?
        </Typography>
        {chips}
        {esAuto && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.68rem', mt: 0.5 }}>
            Automático: usa el más reciente entre la receta y la última compra. Ahora activo: {activoTxt}.
          </Typography>
        )}
      </Box>
    );
  }

  // variant === 'aviso'
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Chip
        label={`Costo activo: ${activoTxt}${esAuto ? ' (auto)' : ''}`}
        size="small"
        onClick={() => setAbierto(v => !v)}
        variant="outlined"
        sx={{ fontSize: '0.72rem', height: 24, cursor: 'pointer', borderColor: PRIMARY, color: PRIMARY }}
      />
      {abierto && chips}
    </Box>
  );
}
