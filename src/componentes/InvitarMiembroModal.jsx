/* eslint-disable no-empty */
// src/componentes/InvitarMiembroModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, MenuItem, Alert, Typography, Box,
} from '@mui/material';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';

import { createInvitation } from '@/servicios/apiTeam';
import { useAccess } from '@/context/AccessContext';

const tc = 'var(--color-primary, #3b82f6)';

export default function InvitarMiembroModal({ open, onClose, scopeType, scopeId, scopeName, onCreated }) {
  const { isOwner, canDo } = useAccess();
  const puedeInvitarAdmin = isOwner;
  const puedeInvitarStaff = canDo('invite_staff');

  const [email, setEmail]   = useState('');
  const [alias, setAlias]   = useState('');
  const [role, setRole]     = useState(puedeInvitarAdmin ? 'admin' : 'staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!open) {
      setEmail(''); setAlias(''); setRole(puedeInvitarAdmin ? 'admin' : 'staff');
      setError(null); setSuccess(null); setLoading(false);
    }
  }, [open, puedeInvitarAdmin]);

  const handleSubmit = async () => {
    setError(null); setSuccess(null);
    if (!email.trim() || !alias.trim()) {
      setError('Completá email y alias');
      return;
    }
    setLoading(true);
    try {
      const res = await createInvitation({
        email: email.trim(),
        scopeType, scopeId,
        role,
        alias: alias.trim(),
      });
      if (res?.ok) {
        setSuccess(
          res.delivered
            ? `Invitación enviada a ${email.trim()}`
            : `Invitación creada. El mail no se pudo enviar; podés copiar el link desde el listado.`
        );
        try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
        onCreated?.(res);
      } else {
        setError(res?.error || 'No se pudo crear la invitación');
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error al invitar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <GroupAddOutlinedIcon sx={{ color: tc }} />
        Invitar miembro
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.2}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Negocio
            </Typography>
            <Typography variant="body2" fontWeight={600}>{scopeName || `#${scopeId}`}</Typography>
          </Box>

          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            fullWidth
            size="small"
            autoFocus
          />

          <TextField
            label="Alias"
            placeholder="Ej: Juan Cocina, Admin Principal"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            fullWidth
            size="small"
            helperText="Cómo querés verlo en el historial y en el equipo"
          />

          <TextField
            label="Rol"
            select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            size="small"
          >
            {puedeInvitarAdmin && (
              <MenuItem value="admin">Administrador</MenuItem>
            )}
            {puedeInvitarStaff && (
              <MenuItem value="staff">Staff (operativo)</MenuItem>
            )}
          </TextField>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleSubmit}
          disabled={loading}
          variant="contained"
          sx={{ bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.9)' } }}
        >
          {loading ? 'Enviando…' : 'Enviar invitación'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}