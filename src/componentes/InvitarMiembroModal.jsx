/* eslint-disable no-empty */
// src/componentes/InvitarMiembroModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, MenuItem, Alert, Typography, Box,
  Radio, RadioGroup, FormControlLabel, FormControl, Chip,
} from '@mui/material';
import GroupAddOutlinedIcon     from '@mui/icons-material/GroupAddOutlined';
import BusinessIcon             from '@mui/icons-material/Business';
import StorefrontOutlinedIcon   from '@mui/icons-material/StorefrontOutlined';

import { createInvitation }   from '@/servicios/apiTeam';
import { useAccess }          from '@/context/AccessContext';
import { useBusiness }        from '@/context/BusinessContext';
import { useOrganization }    from '@/context/OrganizationContext';

const tc = 'var(--color-primary, #3b82f6)';

export default function InvitarMiembroModal({ open, onClose, scopeType, scopeId, scopeName, onCreated }) {
  const { isOwner, canDo }       = useAccess();
  const { items: allBusinesses } = useBusiness() || {};
  const { organization }         = useOrganization() || {};

  const puedeInvitarAdmin = isOwner;
  const puedeInvitarStaff = canDo('invite_staff');

  const [email, setEmail]                     = useState('');
  const [alias, setAlias]                     = useState('');
  const [role, setRole]                       = useState(puedeInvitarAdmin ? 'admin' : 'staff');
  const [selectedScopeKey, setSelectedScopeKey] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setEmail(''); setAlias('');
      setRole(puedeInvitarAdmin ? 'admin' : 'staff');
      setSelectedScopeKey('');
      setError(null); setLoading(false);
    } else {
      // Por default queda preseleccionado el scope del negocio donde se abrió el modal
      setSelectedScopeKey(`${scopeType}:${scopeId}`);
    }
  }, [open, puedeInvitarAdmin, scopeType, scopeId]);

  // IDs de los negocios que pertenecen a la organización actual (si hay)
  const orgBusinessIds = useMemo(() => {
    return new Set((organization?.businesses || []).map(b => Number(b.id)));
  }, [organization]);

  // Sub-negocios de la org, ordenados por antigüedad (el principal arriba)
  const subNegociosOrg = useMemo(() => {
    return [...(organization?.businesses || [])].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ta - tb;
    });
  }, [organization]);

  // Negocios accesibles que NO pertenecen a la organización actual (independientes / otras orgs)
  const negociosSueltos = useMemo(() => {
    return (allBusinesses || [])
      .filter(b => !orgBusinessIds.has(Number(b.id)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [allBusinesses, orgBusinessIds]);

  // True cuando el radio activo es "toda la organización"
  const isOrgSelected = !!organization
    && selectedScopeKey === `organization:${organization.id}`;

  // El selector solo tiene sentido si el rol es admin y hay más de una opción posible
  const mostrarSelector = role === 'admin'
    && (organization || negociosSueltos.length > 1);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !alias.trim()) {
      setError('Completá email y alias');
      return;
    }

    // Resolver scope final: si hay selector, usar la elección del radio; si no, los props
    let finalScopeType = scopeType;
    let finalScopeId   = scopeId;

    if (mostrarSelector && selectedScopeKey) {
      const [t, id] = selectedScopeKey.split(':');
      finalScopeType = t;
      finalScopeId   = Number(id);
    }

    if (!finalScopeType || !finalScopeId) {
      setError('Elegí un alcance válido');
      return;
    }

    setLoading(true);
    try {
      const res = await createInvitation({
        email: email.trim(),
        scopeType: finalScopeType,
        scopeId: finalScopeId,
        role,
        alias: alias.trim(),
      });

      if (res?.ok) {
        try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
        onCreated?.({
          ...res,
          successMessage: res.delivered
            ? `Invitación enviada a ${email.trim()}`
            : `Invitación creada. El mail no se pudo enviar; copiá el link desde el listado.`,
        });
        onClose?.();
        return;
      }

      setError(res?.error || 'No se pudo crear la invitación');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Error al invitar');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <GroupAddOutlinedIcon sx={{ color: tc }} />
        Invitar miembro
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.2}>
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
            {puedeInvitarAdmin && <MenuItem value="admin">Administrador</MenuItem>}
            {puedeInvitarStaff && <MenuItem value="staff">Staff (operativo)</MenuItem>}
          </TextField>

          {/* Selector de alcance (solo para admin con múltiples opciones) */}
          {mostrarSelector ? (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: '0.04em' }}
              >
                ALCANCE DEL ACCESO
              </Typography>

              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={selectedScopeKey}
                  onChange={(e) => setSelectedScopeKey(e.target.value)}
                >
                  {/* ── Organización completa + sub-negocios indentados ── */}
                  {organization && (
                    <Box sx={{
                      border: '1px solid', borderColor: 'divider',
                      borderRadius: 1.5, p: 1.5, mb: 1.5,
                      bgcolor: 'background.paper',
                    }}>
                      <FormControlLabel
                        value={`organization:${organization.id}`}
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <BusinessIcon sx={{ fontSize: 16, color: tc }} />
                              <Typography variant="body2" fontWeight={700}>
                                {organization.name}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Incluye todos los sub-negocios actuales y futuros
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', m: 0 }}
                      />

                      {subNegociosOrg.length > 0 && (
                        <Box sx={{
                          ml: 3.5, mt: 1, pl: 1.5,
                          borderLeft: '1px dashed', borderColor: 'divider',
                        }}>
                         {subNegociosOrg.map((biz) => (
                            <FormControlLabel
                              key={biz.id}
                              value={`business:${biz.id}`}
                              control={<Radio size="small" />}
                              label={
                                <Box>
                                  <Stack direction="row" alignItems="center" spacing={0.75}>
                                    <Typography
                                      variant="body2"
                                      sx={isOrgSelected ? { color: tc, fontWeight: 600 } : undefined}
                                    >
                                      {biz.name}
                                    </Typography>
                                    {isOrgSelected && (
                                      <Chip
                                        label="incluido"
                                        size="small"
                                        sx={{
                                          height: 16, fontSize: '0.62rem', fontWeight: 700,
                                          bgcolor: `${tc}20`, color: tc,
                                          '& .MuiChip-label': { px: 0.75 },
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary">
                                    {isOrgSelected ? 'Cubierto por la organización' : 'Solo este sub-negocio'}
                                  </Typography>
                                </Box>
                              }
                              sx={{
                                alignItems: 'flex-start',
                                m: 0, mt: 0.75,
                                display: 'flex',
                                ...(isOrgSelected && {
                                  bgcolor: `${tc}08`,
                                  borderRadius: 1,
                                  px: 1, py: 0.5,
                                }),
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* ── Negocios independientes / de otras orgs ── */}
                  {negociosSueltos.map((biz) => (
                    <Box
                      key={biz.id}
                      sx={{
                        border: '1px solid', borderColor: 'divider',
                        borderRadius: 1.5, p: 1.5, mb: 1,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <FormControlLabel
                        value={`business:${biz.id}`}
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <StorefrontOutlinedIcon sx={{ fontSize: 16, color: tc }} />
                              <Typography variant="body2" fontWeight={700}>{biz.name}</Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              Negocio independiente
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', m: 0 }}
                      />
                    </Box>
                  ))}
                </RadioGroup>
              </FormControl>
            </Box>
          ) : (
            /* Staff o sin opciones múltiples: scope fijo al negocio actual */
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Negocio
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {scopeName || `#${scopeId}`}
              </Typography>
            </Box>
          )}

          {error   && <Alert severity="error">{error}</Alert>}
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