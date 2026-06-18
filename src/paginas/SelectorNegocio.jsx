// src/paginas/SelectorNegocio.jsx
//
// Pantalla full-screen que se muestra al loguear si el usuario tiene
// más de un negocio accesible y aún no eligió uno como activo.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Paper, Stack, Typography, Avatar, Button, CircularProgress, Chip,
} from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import { useAccess } from '@/context/AccessContext';

const tc = 'var(--color-primary, #3b82f6)';

const roleLabel = (r) => ({
  owner: 'Propietario',
  admin: 'Administrador',
  staff: 'Operativo',
}[r] || r);

const roleColor = (r) => ({
  owner: '#16a34a',
  admin: '#0ea5e9',
  staff: '#a16207',
}[r] || '#64748b');

export default function SelectorNegocio() {
  const { businesses, switchToBusiness, loading } = useAccess();
  const [picking, setPicking] = useState(null);
  const navigate = useNavigate();

  const handlePick = async (bizId) => {
    setPicking(bizId);
    try {
      await switchToBusiness(bizId);
      localStorage.setItem('activeBusinessId', String(bizId));
      navigate('/', { replace: true });
    } finally {
      setPicking(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#f8fafc',
      px: { xs: 2, md: 4 },
      py: { xs: 4, md: 6 },
    }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Stack alignItems="center" spacing={1.2} mb={5}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: `${tc}18`, display: 'grid', placeItems: 'center',
          }}>
            <StorefrontOutlinedIcon sx={{ color: tc, fontSize: 30 }} />
          </Box>
          <Typography variant="h5" fontWeight={800}>¿Con qué negocio querés trabajar?</Typography>
          <Typography variant="body2" color="text.secondary">
            Tenés acceso a varios. Elegí uno para empezar — podés cambiar después.
          </Typography>
        </Stack>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2.5,
        }}>
          {businesses.map((b) => (
            <Paper
              key={b.id}
              variant="outlined"
              sx={{
                p: 2.5, borderRadius: 2.5,
                cursor: 'pointer',
                transition: 'all .15s ease',
                '&:hover': { borderColor: tc, boxShadow: `0 4px 16px ${tc}22` },
                position: 'relative',
              }}
              onClick={() => handlePick(b.id)}
            >
              {picking === b.id && (
                <Box sx={{
                  position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,.7)',
                  display: 'grid', placeItems: 'center', borderRadius: 2.5,
                }}>
                  <CircularProgress size={24} />
                </Box>
              )}

              <Stack spacing={1.4}>
                <Stack direction="row" spacing={1.4} alignItems="center">
                  {b.brand_logo_url ? (
                    <Avatar src={b.brand_logo_url} sx={{ width: 44, height: 44 }} />
                  ) : (
                    <Avatar sx={{
                      width: 44, height: 44,
                      bgcolor: b.color_hex || tc,
                      fontWeight: 700, fontSize: '1rem',
                    }}>
                      {(b.name || '?')[0].toUpperCase()}
                    </Avatar>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" fontWeight={700} noWrap>
                      {b.name}
                    </Typography>
                    {b.organization_name && (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <BusinessIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {b.organization_name}
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                </Stack>

                <Stack direction="row" spacing={0.7} flexWrap="wrap">
                  <Chip
                    label={roleLabel(b.role)}
                    size="small"
                    sx={{
                      fontSize: '0.68rem', height: 20,
                      bgcolor: `${roleColor(b.role)}15`,
                      color: roleColor(b.role),
                      fontWeight: 600,
                    }}
                  />
                  {b.alias && (
                    <Chip
                      label={b.alias}
                      size="small"
                      sx={{ fontSize: '0.68rem', height: 20 }}
                    />
                  )}
                  {b.source === 'organization' && (
                    <Chip
                      label="Heredado de org"
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.62rem', height: 20 }}
                    />
                  )}
                </Stack>

                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  disabled={!!picking}
                  sx={{
                    mt: 0.5, fontWeight: 700, borderRadius: 1.6,
                    bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.92)' },
                  }}
                >
                  Entrar
                </Button>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
}