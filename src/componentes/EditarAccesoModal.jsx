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

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Typography, Box, Chip, IconButton, MenuItem,
  TextField, Alert, Divider, CircularProgress, Tooltip,
} from '@mui/material';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { createInvitation, revokeAssignment, updateAssignment } from '@/servicios/apiTeam';
import { listarSectores } from '@/servicios/apiSectores';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import { showConfirm } from '@/servicios/appConfirm';
import GestionarSectoresModal from '@/componentes/GestionarSectoresModal';

const tc = 'var(--color-primary, #3b82f6)';

/* ─── Fila de un negocio con acceso: ver, editar rol/sector, o quitar ─── */
function FilaNegocio({ n, puedeInvitarAdmin, busy, onQuitar, onGuardado }) {
  const [editando, setEditando] = useState(false);
  const [rol, setRol] = useState(n.role);
  const [sectorIds, setSectorIds] = useState(() => new Set(n.sectorIds || []));
  const [sectores, setSectores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState(null);
  const [gestionando, setGestionando] = useState(false);

  const cargarSectores = () => {
    if (rol !== 'staff' || n.scopeType !== 'business') { setSectores([]); return; }
    listarSectores(n.scopeId)
      .then((list) => setSectores(Array.isArray(list) ? list : []))
      .catch(() => setSectores([]));
  };

  useEffect(() => {
    if (!editando) return;
    cargarSectores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, rol, n.scopeType, n.scopeId]);

  const empezarEdicion = () => {
    setRol(n.role);
    setSectorIds(new Set(n.sectorIds || []));
    setErrorEdit(null);
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true); setErrorEdit(null);
    try {
      await updateAssignment(n.assignmentId, {
        role: rol,
        sectorIds: rol === 'staff' ? Array.from(sectorIds) : [],
      });
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      setEditando(false);
      onGuardado?.();
    } catch (e) {
      setErrorEdit(e?.response?.data?.error || e?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const puedeEditar = n.role !== 'owner' && !!n.assignmentId;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BusinessIcon sx={{ fontSize: 16, color: tc }} />
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
          {n.scopeName}
        </Typography>
        {!editando && (
          <Chip label={n.role} size="small"
            sx={{ height: 20, fontSize: '0.66rem', bgcolor: `${tc}15`, color: tc }} />
        )}
        {n.account_status === 'invited' && (
          <Chip label="pendiente" size="small" color="warning" variant="outlined"
            sx={{ height: 20, fontSize: '0.62rem' }} />
        )}
        {puedeEditar && !editando && (
          <Tooltip title="Editar rol/sector">
            <span>
              <IconButton size="small" onClick={empezarEdicion} disabled={busy}>
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title="Quitar acceso a este negocio">
          <span>
            <IconButton size="small" onClick={() => onQuitar(n)} disabled={busy}
              sx={{ color: 'error.main' }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {editando && (
        <Box sx={{ mt: 1.25 }}>
          {errorEdit && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErrorEdit(null)}>{errorEdit}</Alert>}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select label="Rol" size="small" value={rol}
              onChange={(e) => setRol(e.target.value)}
              sx={{ width: 140 }}
            >
              {puedeInvitarAdmin && <MenuItem value="admin">Administrador</MenuItem>}
              <MenuItem value="staff">Staff</MenuItem>
            </TextField>
            <Button size="small" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Button>
            <Button size="small" variant="contained" onClick={guardar} disabled={guardando}
              sx={{ bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.9)' } }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </Stack>

          {rol === 'staff' && n.scopeType === 'business' && (
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: `${tc}08`, border: `1px solid ${tc}30`, mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                SECTOR DENTRO DE {n.scopeName}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                {sectores.map((s) => {
                  const activo = sectorIds.has(s.id);
                  return (
                    <Chip
                      key={s.id}
                      label={s.nombre}
                      size="small"
                      onClick={() => setSectorIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                        return next;
                      })}
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
                onClose={() => { setGestionando(false); cargarSectores(); }}
                businessId={n.scopeId}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function EditarAccesoModal({ open, onClose, persona, onChanged }) {
  const { items: allBusinesses } = useBusiness() || {};
  const { canDo } = useAccess() || {};
  const puedeInvitarAdmin = canDo?.('invite_admin');

  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fila "agregar negocio"
  const [nuevoBizId, setNuevoBizId] = useState('');
  const [nuevoRol, setNuevoRol] = useState(puedeInvitarAdmin ? 'admin' : 'staff');
  const [sectores, setSectores] = useState([]);
  const [sectorIds, setSectorIds] = useState(() => new Set());
  const [gestionandoSectores, setGestionandoSectores] = useState(false);

  const negocios = persona?.negocios || [];

  // Sector (Vista Operación): mismo criterio que InvitarMiembroModal — solo
  // tiene sentido con rol Staff, y se carga para el negocio recién elegido.
  useEffect(() => {
    if (nuevoRol !== 'staff' || !nuevoBizId) { setSectores([]); setSectorIds(new Set()); return; }
    let alive = true;
    listarSectores(nuevoBizId)
      .then((list) => { if (alive) setSectores(Array.isArray(list) ? list : []); })
      .catch(() => { if (alive) setSectores([]); });
    return () => { alive = false; };
  }, [nuevoRol, nuevoBizId]);

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
    if (!(await showConfirm(`¿Quitar el acceso de "${persona.alias || persona.email}" a ${n.scopeName}?`, { danger: true }))) return;
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
        sectorIds: nuevoRol === 'staff' && sectorIds.size ? Array.from(sectorIds) : undefined,
      });
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch {}
      setNuevoBizId('');
      setSectorIds(new Set());
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
                <FilaNegocio
                  key={n.assignmentId ?? `${n.scopeType}-${n.scopeId}`}
                  n={n}
                  puedeInvitarAdmin={puedeInvitarAdmin}
                  busy={busy}
                  onQuitar={quitarAcceso}
                  onGuardado={onChanged}
                />
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
                  {puedeInvitarAdmin && <MenuItem value="admin">Administrador</MenuItem>}
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

            {/* Sector (Vista Operación) — solo con rol Staff y negocio elegido */}
            {nuevoRol === 'staff' && nuevoBizId && (
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: `${tc}08`, border: `1px solid ${tc}30`, mt: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  SECTOR DENTRO DE {negociosDisponibles.find((b) => String(b.id) === String(nuevoBizId))?.name || `#${nuevoBizId}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Define qué recetas ve. Podés tildar más de uno.
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
                  {sectores.map((s) => {
                    const activo = sectorIds.has(s.id);
                    return (
                      <Chip
                        key={s.id}
                        label={s.nombre}
                        size="small"
                        onClick={() => setSectorIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                          return next;
                        })}
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
                    onClick={() => setGestionandoSectores(true)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Stack>
                <GestionarSectoresModal
                  open={gestionandoSectores}
                  onClose={() => {
                    setGestionandoSectores(false);
                    listarSectores(nuevoBizId)
                      .then((list) => setSectores(Array.isArray(list) ? list : []))
                      .catch(() => {});
                  }}
                  businessId={nuevoBizId}
                />
              </Box>
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