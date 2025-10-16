// src/componentes/PalettePicker.jsx
import React from 'react';
import { Stack, Chip, Tooltip } from '@mui/material';
import { DEFAULT_PALETTES } from '../tema/paletas';
import { useBizTheme } from '../tema/ThemeProviderNegocio';
import { BusinessesAPI } from "@/servicios/apiBusinesses";

export default function PalettePicker() {
  const { palette, setPaletteForBiz } = useBizTheme();
  const entries = Object.entries(DEFAULT_PALETTES);
  const activeBizId = localStorage.getItem('activeBusinessId');

  const handlePick = async (p) => {
    // 1) aplica en vivo (CSS vars)
    setPaletteForBiz(p, { persist: true });

    // 2) guarda en backend el tema del negocio
    try {
      if (activeBizId) {
        await BusinessesAPI.update(activeBizId, { theme: p }); // adapta si tu API espera otro shape
      }
    } catch (e) {
      console.error('No se pudo guardar la paleta en backend', e);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {entries.map(([key, p]) => (
        <Tooltip key={key} title={p.name}>
          <Chip
            label={p.name}
            onClick={() => handlePick(p)}
            variant={palette?.name === p.name ? 'filled' : 'outlined'}
            sx={{
              cursor: 'pointer',
              bgcolor: palette?.name === p.name ? p.primary : 'transparent',
              color: palette?.name === p.name ? '#fff' : 'inherit',
              borderColor: p.primary,
            }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}
