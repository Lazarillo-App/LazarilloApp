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
import { RolesAPI } from '@/servicios/apiRoles';
import GestionarSectoresModal from '@/componentes/GestionarSectoresModal';

const tc = 'var(--color-primary, #3b82f6)';

/* ─── Fila de un negocio con acceso: ver, editar rol/sector, o quitar ─── */
const ROL_LABEL = { owner: 'Dueño', admin: 'Administración', staff: 'Staff' };
// Valor del selector: 'admin' | 'staff' | 'rol:<id>' (rol a medida, se guarda como admin + customRoleId).
// Subroles de Staff (Diego 11/11/2026): 'staff:<id>' = subrol a medida (Jefe de cocina, Cocinero…).
const valorRol = (n) => (n.role === 'admin' && n.customRoleId ? `rol:${n.customRoleId}` : (n.role === 'staff' && n.customRoleId ? `staff:${n.customRoleId}` : n.role));
const CREAR_SUBROL = '__crear_subrol';

function FilaNegocio({ n, puedeInvitarAdmin, busy, onQuitar, onGuardado }) {
  const { isOwner, businesses = [] } = useAccess() || {};
  const [editando, setEditando] = useState(false);
  const [rol, setRol] = useState(valorRol(n));
  const [rolesMedida, setRolesMedida] = useState([]);
  const [subroles, setSubroles] = useState([]);
  const [creando, setCreando] = useState(null); // null | '' | nombre en edición
  const [sectorIds, setSectorIds] = useState(() => new Set(n.sectorIds || []));
  const [sectores, setSectores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState(null);
  const [gestionando, setGestionando] = useState(false);

  // Roles a medida de la organización de este acceso (solo los asigna el dueño).
  const bizDeFila = n.scopeType === 'business'
    ? n.scopeId
    : businesses.find((b) => Number(b.organization_id) === Number(n.scopeId))?.id;
  const cargarSubroles = () => RolesAPI.listStaff(bizDeFila).then((st) => { setSubroles(st?.subroles || []); return st?.subroles || []; }).catch(() => []);
  useEffect(() => {
    if (!editando || !bizDeFila) return;
    if (isOwner) RolesAPI.list(bizDeFila).then(setRolesMedida).catch(() => setRolesMedida([]));
    cargarSubroles();
  }, [editando, isOwner, n.scopeType, n.scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const crearSubrol = async () => {
    const nombre = String(creando || '').trim();
    if (!nombre) return;
    try {
      const res = await RolesAPI.createStaff(nombre, bizDeFila);
      await cargarSubroles();
      if (res?.subrol?.id) setRol(`staff:${res.subrol.id}`);
      setCreando(null);
    } catch (e) {
      const err = e?.response?.data?.error || e?.data?.error || e?.message;
      setErrorEdit(err === 'nombre_repetido' ? 'Ya hay un rol con ese nombre.' : err === 'nombre_reservado' ? 'Ese nombre lo usa un rol fijo.' : (err || 'No se pudo crear'));
    }
  };
  const subrolElegido = rol.startsWith('staff:') ? subroles.find((x) => `staff:${x.id}` === rol) : null;

  const cargarSectores = () => {
    if (!rol.startsWith('staff') || n.scopeType !== 'business') { setSectores([]); return; }
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
    setRol(valorRol(n));
    setSectorIds(new Set(n.sectorIds || []));
    setErrorEdit(null);
    setEditando(true);
  };

  const guardar = async () => {
    setGuardando(true); setErrorEdit(null);
    try {
      const esMedida = rol.startsWith('rol:');
      const role = esMedida ? 'admin' : (rol.startsWith('staff') ? 'staff' : rol);
      await updateAssignment(n.assignmentId, {
        role,
        ...(role === 'staff' ? { customRoleId: rol.startsWith('staff:') ? Number(rol.slice(6)) : null } : {}),
        sectorIds: role === 'staff' ? Array.from(sectorIds) : [],
        // Solo el dueño toca el rol a medida (null = Administración completa).
        ...(isOwner && role === 'admin' ? { customRoleId: esMedida ? Number(rol.slice(4)) : null } : {}),
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
          <Chip label={(n.role === 'staff' && n.customRoleNombre ? `Staff · ${n.customRoleNombre}` : n.customRoleNombre) || ROL_LABEL[n.role] || n.role} size="small"
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
              onChange={(e) => { if (e.target.value === CREAR_SUBROL) { setCreando(''); return; } setRol(e.target.value); }}
              sx={{ width: 190 }}
            >
              {/* Acción primero, en franja gris (patrón de desplegables con acción). */}
              <MenuItem value={CREAR_SUBROL} divider
                sx={{ bgcolor: 'action.hover', color: 'primary.main', fontWeight: 600, fontSize: '0.85rem', '&:hover': { bgcolor: 'action.selected' } }}>
                + Crear subrol de Staff
              </MenuItem>
              {puedeInvitarAdmin && <MenuItem value="admin">Administración</MenuItem>}
              {puedeInvitarAdmin && rolesMedida.map((r) => <MenuItem key={r.id} value={`rol:${r.id}`}>{r.nombre}</MenuItem>)}
              {/* Si el rol a medida ya no está en la lista (otra organización), igual se muestra. */}
              {rol.startsWith('rol:') && !rolesMedida.some((r) => `rol:${r.id}` === rol) && <MenuItem value={rol}>{n.customRoleNombre || 'Rol a medida'}</MenuItem>}
              <MenuItem value="staff">Staff</MenuItem>
              {subroles.map((x) => (
                <MenuItem key={x.id} value={`staff:${x.id}`} sx={{ pl: 3.5 }}>
                  <Typography component="span" sx={{ fontSize: 'inherit', color: 'text.secondary', mr: 0.75 }}>└</Typography>{x.nombre}
                </MenuItem>
              ))}
              {/* Si el subrol ya no está en la lista, igual se muestra. */}
              {rol.startsWith('staff:') && !subroles.some((x) => `staff:${x.id}` === rol) && (
                <MenuItem value={rol} sx={{ pl: 3.5 }}>└ {n.customRoleNombre || 'Subrol'}</MenuItem>
              )}
            </TextField>
            <Button size="small" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</Button>
            <Button size="small" variant="contained" onClick={guardar} disabled={guardando}
              sx={{ bgcolor: tc, '&:hover': { bgcolor: tc, filter: 'brightness(0.9)' } }}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </Stack>

          {rol.startsWith('staff') && n.scopeType === 'business' && (
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: `${tc}08`, border: `1px solid ${tc}30`, mt: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                {subrolElegido?.permisos?.aprobar_equipo ? `SECTORES QUE CONDUCE EN ${n.scopeName}` : `SECTOR DENTRO DE ${n.scopeName}`}
              </Typography>
              {subrolElegido?.permisos?.aprobar_equipo && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Da el OK a los cambios de su equipo de estos sectores antes de que lleguen a vos. Qué ve se configura en Roles.
                </Typography>
              )}
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
      <Dialog open={creando !== null} onClose={() => setCreando(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Nuevo subrol de Staff</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" placeholder="Ej. Cocinero, Mozo, Jefe de barra" value={creando || ''}
            onChange={(e) => setCreando(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') crearSubrol(); }} sx={{ mt: 0.5 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Nace con lo básico del Staff. Qué más puede hacer se tilda en Mi perfil › Equipo › Roles.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreando(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!String(creando || '').trim()} onClick={crearSubrol} sx={{ bgcolor: tc }}>Crear</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function EditarAccesoModal({ open, onClose, persona, onChanged }) {
  const { items: allBusinesses, activeId } = useBusiness() || {};
  const { canDo, isOwner } = useAccess() || {};
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

  // Roles a medida (Gerente, etc.) del negocio elegido para agregar — igual que en
  // la fila de cada negocio: solo el dueño los asigna (Diego 10/11/2026).
  const [rolesMedidaNuevo, setRolesMedidaNuevo] = useState([]);
  // Sin negocio elegido todavía se muestran los del negocio activo (los roles son de la
  // organización); al elegir negocio se recargan con los de ése (Diego 10/11/2026: «no veo el de gerente»).
  const bizParaRoles = nuevoBizId || activeId || allBusinesses?.[0]?.id || null;
  useEffect(() => {
    if (!isOwner || !bizParaRoles) { setRolesMedidaNuevo([]); return; }
    let alive = true;
    RolesAPI.list(bizParaRoles)
      .then((l) => { if (alive) setRolesMedidaNuevo((Array.isArray(l) ? l : []).filter((r) => !r.es_administracion && !r.esAdministracion)); })
      .catch(() => { if (alive) setRolesMedidaNuevo([]); });
    return () => { alive = false; };
  }, [isOwner, bizParaRoles]);
  useEffect(() => {
    if (nuevoRol.startsWith('rol:') && !rolesMedidaNuevo.some((r) => `rol:${r.id}` === nuevoRol)) setNuevoRol('admin');
  }, [rolesMedidaNuevo]); // eslint-disable-line react-hooks/exhaustive-deps

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
        role: nuevoRol.startsWith('rol:') ? 'admin' : nuevoRol,
        ...(nuevoRol.startsWith('rol:') ? { customRoleId: Number(nuevoRol.slice(4)) } : {}),
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
                  {puedeInvitarAdmin && <MenuItem value="admin">Administración</MenuItem>}
                  {puedeInvitarAdmin && rolesMedidaNuevo.map((r) => <MenuItem key={r.id} value={`rol:${r.id}`}>{r.nombre}</MenuItem>)}
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