/* eslint-disable no-empty */
// src/componentes/InvitarMiembroModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, MenuItem, Alert, Typography, Box,
  Checkbox, FormControlLabel, FormControl, Chip, Autocomplete,
} from '@mui/material';
import GroupAddOutlinedIcon     from '@mui/icons-material/GroupAddOutlined';
import BusinessIcon             from '@mui/icons-material/Business';
import StorefrontOutlinedIcon   from '@mui/icons-material/StorefrontOutlined';

import { createInvitation, listKnownPeople }   from '@/servicios/apiTeam';
import { listarSectores } from '@/servicios/apiSectores';
import { useAccess }          from '@/context/AccessContext';
import { useBusiness }        from '@/context/BusinessContext';
import { useOrganization }    from '@/context/OrganizationContext';
import GestionarSectoresModal from '@/componentes/GestionarSectoresModal';

const tc = 'var(--color-primary, #3b82f6)';

/* ─── Bloque de sector de UN negocio puntual — se repite uno por cada
   negocio elegido, porque el sector nunca cruza de negocio. ─── */
function SectorPickerBox({ businessId, businessName, selected, onToggle }) {
  const [sectores, setSectores] = useState([]);
  const [gestionando, setGestionando] = useState(false);

  const cargar = () => {
    listarSectores(businessId)
      .then((list) => setSectores(Array.isArray(list) ? list : []))
      .catch(() => setSectores([]));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [businessId]);

  return (
    <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: `${tc}08`, border: `1px solid ${tc}30` }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
        SECTOR DENTRO DE {businessName}
      </Typography>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
        {sectores.map((s) => {
          const activo = selected.has(s.id);
          return (
            <Chip
              key={s.id}
              label={s.nombre}
              size="small"
              onClick={() => onToggle(s.id)}
              sx={{
                cursor: 'pointer', fontWeight: 600,
                bgcolor: activo ? tc : 'transparent',
                color: activo ? '#fff' : 'text.primary',
                border: `1px solid ${activo ? tc : '#d8d3ca'}`,
              }}
            />
          );
        })}
        <Chip
          label="Gestionar sectores"
          size="small"
          variant="outlined"
          onClick={() => setGestionando(true)}
          sx={{ cursor: 'pointer' }}
        />
      </Stack>
      <GestionarSectoresModal
        open={gestionando}
        onClose={() => { setGestionando(false); cargar(); }}
        businessId={businessId}
      />
    </Box>
  );
}

export default function InvitarMiembroModal({ open, onClose, scopeType, scopeId, scopeName, onCreated }) {
  const { isOwner, canDo }       = useAccess();
  const { items: allBusinesses } = useBusiness() || {};
  const { organization }         = useOrganization() || {};

  const puedeInvitarAdmin = canDo('invite_admin');
  const puedeInvitarStaff = canDo('invite_staff');

  const [email, setEmail]                     = useState('');
  const [alias, setAlias]                     = useState('');
  const [role, setRole]                       = useState(puedeInvitarAdmin ? 'admin' : 'staff');
  // Selección múltiple: uno o varios negocios/sub-negocios, o la organización entera.
  const [selectedScopeKeys, setSelectedScopeKeys] = useState(() => new Set());
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [knownPeople, setKnownPeople]         = useState([]);
  const [aliasHeredado, setAliasHeredado]     = useState(false); // true si el alias vino de una persona existente
  // Sector elegido por negocio: Map<businessId, Set<sectorId>> — un sector
  // nunca cruza de negocio, así que si se invita a 2+ negocios a la vez cada
  // uno tiene su propio bloque de sectores.
  const [sectorSelByBiz, setSectorSelByBiz]   = useState(() => new Map());

  // Cargar personas conocidas del owner al abrir (para sugerir y heredar alias)
  useEffect(() => {
    if (!open) return;
    let alive = true;
    listKnownPeople()
      .then(list => { if (alive) setKnownPeople(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setKnownPeople([]); });
    return () => { alive = false; };
  }, [open]);

  // Reset al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setEmail(''); setAlias('');
      setAliasHeredado(false);
      setRole(puedeInvitarAdmin ? 'admin' : 'staff');
      setSelectedScopeKeys(new Set());
      setSectorSelByBiz(new Map());
      setError(null); setLoading(false);
    } else {
      // Por default queda preseleccionado el scope del negocio donde se abrió el modal
      setSelectedScopeKeys(new Set([`${scopeType}:${scopeId}`]));
    }
  }, [open, puedeInvitarAdmin, scopeType, scopeId]);

  const toggleScope = (key) => {
    setSelectedScopeKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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

  // True cuando está tildada "toda la organización" (cubre todos los sub-negocios)
  const isOrgSelected = !!organization
    && selectedScopeKeys.has(`organization:${organization.id}`);

  // El selector aplica siempre para admin, y también para Staff cuando quien
  // invita es owner — como owner siempre tiene acceso a todo, no tiene sentido
  // limitarlo al negocio activo (a un admin no-owner sí se lo deja fijo).
  const mostrarSelector = (role === 'admin' || (role === 'staff' && isOwner))
    && (organization || negociosSueltos.length > 1);

  // Negocios puntuales para los bloques de sector — el sector es por-negocio,
  // así que se muestra un bloque por cada negocio tildado (no para "toda la
  // organización", que cubre negocios futuros sin sectores propios todavía).
  const selectedBusinessIds = useMemo(() => {
    if (!mostrarSelector) return Number.isFinite(Number(scopeId)) ? new Set([Number(scopeId)]) : new Set();
    if (isOrgSelected) return new Set();
    return new Set(
      Array.from(selectedScopeKeys)
        .filter((k) => k.startsWith('business:'))
        .map((k) => Number(k.split(':')[1]))
    );
  }, [mostrarSelector, isOrgSelected, selectedScopeKeys, scopeId]);

  const sectorBizIds = role === 'staff' ? Array.from(selectedBusinessIds) : [];

  const nombreDeNegocio = (bizId) => {
    if (!mostrarSelector) return scopeName || `#${bizId}`;
    const biz = [...subNegociosOrg, ...negociosSueltos].find((b) => Number(b.id) === bizId);
    return biz?.name || `#${bizId}`;
  };

  const toggleSector = (bizId, sectorId) => {
    setSectorSelByBiz((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(bizId) || []);
      if (set.has(sectorId)) set.delete(sectorId); else set.add(sectorId);
      next.set(bizId, set);
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !alias.trim()) {
      setError('Completá email y alias');
      return;
    }

    // Resolver scopes finales: si hay selector, uno o varios tildados; si no, el prop fijo.
    // "Organización" cubre todos sus sub-negocios — si está tildada, no hace falta (ni
    // corresponde) mandar también cada sub-negocio suelto. Cada scope de negocio lleva
    // su propio sectorIds (un sector nunca cruza de negocio).
    let scopes;
    if (mostrarSelector) {
      if (selectedScopeKeys.size === 0) {
        setError('Elegí al menos un alcance');
        return;
      }
      scopes = isOrgSelected
        ? [{ scopeType: 'organization', scopeId: organization.id }]
        : Array.from(selectedScopeKeys).map(k => {
          const [t, id] = k.split(':');
          const bizId = Number(id);
          const sel = sectorSelByBiz.get(bizId);
          return {
            scopeType: t, scopeId: bizId,
            sectorIds: (role === 'staff' && t === 'business' && sel?.size) ? Array.from(sel) : undefined,
          };
        });
    } else {
      const sel = sectorSelByBiz.get(Number(scopeId));
      scopes = [{
        scopeType, scopeId,
        sectorIds: (role === 'staff' && sel?.size) ? Array.from(sel) : undefined,
      }];
    }

    setLoading(true);
    try {
      const res = await createInvitation({
        email: email.trim(),
        scopes,
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
    <>
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <GroupAddOutlinedIcon sx={{ color: tc }} />
        Invitar miembro
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.2}>
          <Autocomplete
            freeSolo
            options={knownPeople}
            getOptionLabel={(opt) => typeof opt === 'string' ? opt : (opt?.email || '')}
            filterOptions={(opts, state) => {
              const q = state.inputValue.trim().toLowerCase();
              if (!q) return opts;
              return opts.filter(o =>
                (o.email || '').toLowerCase().includes(q) ||
                (o.alias || '').toLowerCase().includes(q)
              );
            }}
            inputValue={email}
            onInputChange={(_, val, reason) => {
              if (reason === 'input') {
                setEmail(val);
                // Si venía un alias heredado y el usuario cambia el email a mano, liberar el alias
                if (aliasHeredado) { setAliasHeredado(false); setAlias(''); }
              }
            }}
            onChange={(_, val) => {
              // Eligió una persona existente de la lista → heredar email + alias
              if (val && typeof val === 'object') {
                setEmail(val.email || '');
                setAlias(val.alias || '');
                setAliasHeredado(!!val.alias);
              }
            }}
            renderOption={(props, opt) => (
              <Box component="li" {...props} key={opt.user_id || opt.email}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{opt.alias || opt.email}</Typography>
                  {opt.alias && (
                    <Typography variant="caption" color="text.secondary">{opt.email}</Typography>
                  )}
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Email"
                type="email"
                size="small"
                autoFocus
                helperText="Escribí un email nuevo o elegí a alguien de tu equipo"
              />
            )}
          />
          <TextField
            label="Alias"
            placeholder="Ej: Juan Cocina, Admin Principal"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            fullWidth
            size="small"
            disabled={aliasHeredado}
            helperText={aliasHeredado
              ? 'Alias heredado: esta persona ya está en tu equipo'
              : 'Cómo querés verlo en el historial y en el equipo'}
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

          {/* Selector de alcance (admin siempre; Staff también si quien invita es owner) */}
          {mostrarSelector ? (
            <Box>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, letterSpacing: '0.04em' }}
              >
                ALCANCE DEL ACCESO
              </Typography>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Podés tildar varios negocios/sub-negocios a la vez — se manda una sola invitación con acceso a todos los elegidos.
              </Typography>
              <FormControl component="fieldset" fullWidth>
                {/* ── Organización completa + sub-negocios indentados ── */}
                {organization && (
                  <Box sx={{
                    border: '1px solid', borderColor: 'divider',
                    borderRadius: 1.5, p: 1.5, mb: 1.5,
                    bgcolor: 'background.paper',
                  }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={isOrgSelected}
                          onChange={() => toggleScope(`organization:${organization.id}`)}
                        />
                      }
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
                       {subNegociosOrg.map((biz) => {
                          const key = `business:${biz.id}`;
                          const checked = isOrgSelected || selectedScopeKeys.has(key);
                          return (
                            <FormControlLabel
                              key={biz.id}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  disabled={isOrgSelected}
                                  onChange={() => toggleScope(key)}
                                />
                              }
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
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                )}

                {/* ── Negocios independientes / de otras orgs ── */}
                {negociosSueltos.map((biz) => {
                  const key = `business:${biz.id}`;
                  return (
                    <Box
                      key={biz.id}
                      sx={{
                        border: '1px solid', borderColor: 'divider',
                        borderRadius: 1.5, p: 1.5, mb: 1,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={selectedScopeKeys.has(key)}
                            onChange={() => toggleScope(key)}
                          />
                        }
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
                  );
                })}
              </FormControl>
            </Box>
          ) : (
            /* Staff (admin no-owner) o sin opciones múltiples: scope fijo al negocio actual */
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Negocio
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {scopeName || `#${scopeId}`}
              </Typography>
            </Box>
          )}

          {/* Sector dentro de cada negocio elegido (solo Staff) — define qué recetas ve.
              Uno por negocio: nunca se comparte selección entre dos negocios distintos. */}
          {sectorBizIds.length > 0 && (
            <Stack spacing={1.25}>
              {sectorBizIds.map((bizId) => (
                <SectorPickerBox
                  key={bizId}
                  businessId={bizId}
                  businessName={nombreDeNegocio(bizId)}
                  selected={sectorSelByBiz.get(bizId) || new Set()}
                  onToggle={(sectorId) => toggleSector(bizId, sectorId)}
                />
              ))}
            </Stack>
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
    </>
  );
}