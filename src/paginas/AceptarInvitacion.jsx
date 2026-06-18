// src/paginas/AceptarInvitacion.jsx
//
// Página PÚBLICA: el invitado entra con un link tipo
// /aceptar-invitacion?token=...&email=...
// y define su contraseña. Apenas la setea, lo logueamos y lo mandamos a la app.

import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Stack, Typography, TextField, Button, Alert,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { acceptInvitation } from '@/servicios/apiTeam';
import { useAuth } from '@/context/AuthContext';

const tc = 'var(--color-primary, #3b82f6)';

export default function AceptarInvitacion() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const valid = useMemo(() => {
    return token && email && password.length >= 6 && password === confirm;
  }, [token, email, password, confirm]);

  const passwordMismatch = confirm && password !== confirm;
  const passwordTooShort = password && password.length < 6;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      // 1) Activar cuenta
      const res = await acceptInvitation({ token, email, password });
      if (!res?.ok) throw new Error(res?.error || 'invalid_token');

      // 2) Loguear automáticamente con la nueva contraseña
      await login(email, password);

      // 3) A la home — AccessContext decidirá si va al selector o a la app
      navigate('/', { replace: true });
    } catch (err) {
      const code = err?.data?.error || err?.message;
      let msg = 'No se pudo aceptar la invitación.';
      if (code === 'invalid_token')   msg = 'El enlace es inválido. Pedí uno nuevo a quien te invitó.';
      if (code === 'expired_token')   msg = 'El enlace expiró. Pedí uno nuevo.';
      if (code === 'password_too_short') msg = 'La contraseña debe tener al menos 6 caracteres.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
        <Paper sx={{ p: 4, maxWidth: 420, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={800} gutterBottom>Enlace inválido</Typography>
          <Typography variant="body2" color="text.secondary">
            El enlace de invitación no es correcto. Pedile a quien te invitó que te lo reenvíe.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 440, width: '100%', borderRadius: 3 }} elevation={3}>
        <Stack alignItems="center" spacing={1.2} mb={2.5}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: `${tc}15`, display: 'grid', placeItems: 'center',
          }}>
            <LockOutlinedIcon sx={{ color: tc, fontSize: 28 }} />
          </Box>
          <Typography variant="h6" fontWeight={800}>Activá tu cuenta</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Te invitaron a colaborar en Lazarillo.<br />
            Elegí una contraseña para empezar.
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              label="Email"
              value={email}
              disabled
              fullWidth
              size="small"
            />
            <TextField
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              size="small"
              error={!!passwordTooShort}
              helperText={passwordTooShort ? 'Mínimo 6 caracteres' : ' '}
              autoFocus
            />
            <TextField
              label="Repetir contraseña"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              fullWidth
              size="small"
              error={!!passwordMismatch}
              helperText={passwordMismatch ? 'No coinciden' : ' '}
            />

            {error && <Alert severity="error">{error}</Alert>}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!valid || loading}
              sx={{
                py: 1.25, fontWeight: 700, borderRadius: 2,
                bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.92)' },
              }}
            >
              {loading ? 'Activando…' : 'Activar y entrar'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}