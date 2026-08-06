/* eslint-disable no-empty */
// src/componentes/EditarAccesoModal.jsx
//
// Gestiona el acceso de una persona ya existente en el equipo:
// - Ver los negocios donde tiene acceso (con su rol).
// - Quitarle acceso a un negocio (revokeAssignment).
// - Agregarle acceso a otro negocio (createInvitation con su mismo email → el
//   backend hereda su alias automáticamente, así no diverge la identidad).
//
// Recibe la persona consolidada: { email, alias, negocios: [{assignmentId, scopeType, scopeId, scopeName, role, account_status}] }

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, Chip, IconButton, MenuItem,
  TextField, Alert, Divider, CircularProgress, Tooltip,
} from '@mui/material';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { createInvitation, revokeAssignment } from '@/servicios/apiTeam';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';

const tc = 'var(--color-primary, #3b82f6)';

export default function EditarAccesoModal({ open, onClose, persona, onChanged }) {
  const { items: allBusinesses } = useBusiness() || {};
  const { isOwner } = useAccess() || {};

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fila "agregar negocio"
  const [nuevoBizId, setNuevoBizId] = useState('');
  const [nuevoRol, setNuevoRol] = useState(isOwner ? 'admin' : 'staff');

  const negocios = persona?.negocios || [];

  // Negocios donde la persona YA tiene acceso (por scopeId de tipo business)
  const idsConAcceso = useMemo(() => {
    const s = new Set();
    negocios.forEach(n => { if (n.scopeType === 'business') s.add(Number(n.scopeId)); });
    return s;
  }, [negocios]);

  // Negocios disponibles para agregar (los que no tiene todavía)
  const negociosDisponibles = useMemo(() => {
    return (allBusinesses || [])
      .filter(b => !idsConAcceso.has(Number(b.id)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [allBusinesses, idsConAcceso]);

  const quitarAcceso = async (n) => {
    if (!n?.assignmentId) return;
    if (!window.confirm(`¿Quitar el acceso de "${persona.alias || persona.email}" a ${n.scopeName}?`)) return;
    setBusy(true); setError(null);
    try {
      await revokeAssignment(n.assignmentId);
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      onChanged?.();
    } catch (e) {
      setError(e?.message || 'No se pudo quitar el acceso');
    } finally {
      setBusy(false);
    }
  };

  const agregarAcceso = async () => {
    if (!nuevoBizId) { setError('Elegí un negocio para agregar'); return; }
    setBusy(true); setError(null);
    try {
      // Mismo email → el backend hereda el alias existente de la persona.
      await createInvitation({
        email: persona.email,
        scopeType: 'business',
        scopeId: Number(nuevoBizId),
        role: nuevoRol,
        alias: persona.alias || persona.email, // el backend igual lo pisa con el heredado
      });
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      setNuevoBizId('');
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo agregar el acceso');
    } finally {
      setBusy(false);
    }
  };

  if (!persona) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <ManageAccountsOutlinedIcon sx={{ color: tc }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
            Acceso de {persona.alias || persona.email}
          </Typography>
          <Typography variant="caption" color="text.secondary">{persona.email}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

          {/* Negocios actuales */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.04em' }}>
              NEGOCIOS CON ACCESO
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {negocios.length === 0 ? (
                <Typography variant="body2" color="text.disabled">Sin accesos activos.</Typography>
              ) : negocios.map(n => (
                <Stack key={n.assignmentId ?? `${n.scopeType}-${n.scopeId}`}
                  direction="row" alignItems="center" spacing={1}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1 }}>
                  <BusinessIcon sx={{ fontSize: 16, color: tc }} />
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                    {n.scopeName}
                  </Typography>
                  <Chip label={n.role} size="small"
                    sx={{ height: 20, fontSize: '0.66rem', bgcolor: `${tc}15`, color: tc }} />
                  {n.account_status === 'invited' && (
                    <Chip label="pendiente" size="small" color="warning" variant="outlined"
                      sx={{ height: 20, fontSize: '0.62rem' }} />
                  )}
                  <Tooltip title="Quitar acceso a este negocio">
                    <span>
                      <IconButton size="small" onClick={() => quitarAcceso(n)} disabled={busy}
                        sx={{ color: 'error.main' }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Agregar negocio */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.04em' }}>
              AGREGAR A OTRO NEGOCIO
            </Typography>
            {negociosDisponibles.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                Ya tiene acceso a todos tus negocios.
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="flex-start">
                <TextField
                  select
                  label="Negocio"
                  size="small"
                  value={nuevoBizId}
                  onChange={(e) => setNuevoBizId(e.target.value)}
                  sx={{ flex: 1 }}
                >
                  {negociosDisponibles.map(b => (
                    <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Rol"
                  size="small"
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                  sx={{ width: 140 }}
                >
                  {isOwner && <MenuItem value="admin">Administrador</MenuItem>}
                  <MenuItem value="staff">Staff</MenuItem>
                </TextField>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={agregarAcceso}
                  disabled={busy || !nuevoBizId}
                  sx={{ bgcolor: tc, mt: 0.25, '&:hover': { bgcolor: tc, filter: 'brightness(0.9)' } }}
                >
                  Agregar
                </Button>
              </Stack>
            )}
          </Box>

          {busy && (
            <Stack alignItems="center"><CircularProgress size={20} /></Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}