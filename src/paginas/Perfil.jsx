/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/paginas/Perfil.jsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Avatar, Chip, Button, Paper,
  Divider, IconButton, Tooltip, Table, TableHead, Snackbar,
  TableRow, TableCell, TableBody, CircularProgress, Menu, MenuItem, Collapse,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import EditIcon from '@mui/icons-material/Edit';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { MeAPI } from '@/servicios/apiMe';
import { useOrganization } from '@/context/OrganizationContext';
import { useBusiness } from '@/context/BusinessContext';
import { useAccess } from '@/context/AccessContext';
import BusinessCreateModal from '@/componentes/BusinessCreateModal';
import InvitarMiembroModal from '@/componentes/InvitarMiembroModal';
import EditarAccesoModal from '@/componentes/EditarAccesoModal';
import { syncAll, isMaxiConfigured } from '@/servicios/syncservice';
import { ensureTodo } from '@/servicios/apiAgrupacionesTodo';
import {
  listMembers, resendInvitation, revokeAssignment,
} from '@/servicios/apiTeam';
import { useNavigate } from 'react-router-dom';
import AsistenteOnboarding from '@/componentes/asistente/AsistenteOnboarding';

const tc = 'var(--color-primary, #3b82f6)';

/* ─── Sección genérica ─── */
function Section({ icon, title, badge, children, action }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {React.cloneElement(icon, { sx: { color: tc, fontSize: 18 } })}
          <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>{title}</Typography>
          {badge && (
            <Chip label={badge} size="small"
              sx={{ fontSize: '0.62rem', height: 18, bgcolor: '#f1f5f9', color: '#64748b' }} />
          )}
        </Stack>
        {action}
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

/* ─── Fila de dato ─── */
function DataRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <Stack direction="row" spacing={2} alignItems="baseline"
      sx={{ py: 1, '& + &': { borderTop: '1px solid #f3f4f6' } }}>
      <Typography variant="caption" color="text.secondary"
        sx={{ minWidth: 120, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500}
        sx={{ fontSize: '0.85rem', ...(mono && { fontFamily: 'monospace', fontSize: '0.82rem' }) }}>
        {value}
      </Typography>
    </Stack>
  );
}

/* ─── EQUIPO funcional ─── */
function TeamSection() {
  const { currentBusiness, currentRole, canDo, isOwner } = useAccess();
  const { items: allBusinesses } = useBusiness() || {};
  const { organization } = useOrganization() || {};
  const bizId = currentBusiness?.id || null;
  const bizName = currentBusiness?.name || null;

  // Mapa scope_id → nombre de negocio (para la columna Negocios de la vista consolidada)
  const bizNameById = useMemo(() => {
    const m = new Map();
    (allBusinesses || []).forEach(b => m.set(Number(b.id), b.name || `#${b.id}`));
    return m;
  }, [allBusinesses]);

  const [members, setMembers] = useState([]);        // consolidado por persona
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
const [expandedEmail, setExpandedEmail] = useState(null); // fila expandida (detalle de negocios)
  const [editandoPersona, setEditandoPersona] = useState(null); // persona en el modal de editar acceso

  // Menú contextual por fila
  const [menuRow, setMenuRow] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const [snack, setSnack] = useState(null);

  const puedeGestionar = canDo('manage_team') && !!bizId;

  const fetchMembers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Sin scope: trae TODOS los assignments visibles para el caller (todo el equipo,
      // en todos sus negocios). Consolidamos por email → una fila por persona.
      const rows = await listMembers();
      const porEmail = new Map();
      for (const r of rows) {
        const email = r.email || `#${r.user_id}`;
        if (!porEmail.has(email)) {
          porEmail.set(email, {
            email,
            user_id: r.user_id,
            alias: r.alias || r.name || null,
            name: r.name || null,
            account_status: r.account_status,
            negocios: [],
          });
        }
        const persona = porEmail.get(email);
        // Preferir el alias no vacío que aparezca
        if (!persona.alias && (r.alias || r.name)) persona.alias = r.alias || r.name;
        const scopeIdNum = Number(r.scope_id);
        const scopeName = r.scope_type === 'organization'
          ? (organization?.name || `Org #${r.scope_id}`)
          : (bizNameById.get(scopeIdNum) || `#${r.scope_id}`);
        persona.negocios.push({
          assignmentId: r.id,
          scopeType: r.scope_type,
          scopeId: scopeIdNum,
          scopeName,
          role: r.role,
          account_status: r.account_status,
        });
      }
      // Rol más alto por persona (para el chip principal)
      const rank = { owner: 3, admin: 2, staff: 1 };
      const lista = Array.from(porEmail.values()).map(p => {
        let rolMasAlto = null, best = 0;
        for (const n of p.negocios) {
          if (rank[n.role] > best) { best = rank[n.role]; rolMasAlto = n.role; }
        }
        return { ...p, rolMasAlto };
      });
      setMembers(lista);
    } catch (e) {
      setError(e?.message || 'Error al cargar equipo');
    } finally {
      setLoading(false);
    }
  }, [bizNameById, organization]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useEffect(() => {
    const onChange = () => fetchMembers();
    window.addEventListener('team:changed', onChange);
    return () => window.removeEventListener('team:changed', onChange);
  }, [fetchMembers]);

  const handleResend = async (assignmentId) => {
    try {
      const res = await resendInvitation(assignmentId);
      alert(res?.delivered
        ? 'Invitación reenviada.'
        : 'Invitación regenerada (el mail no se pudo enviar).');
    } catch (e) {
      alert(`Error: ${e?.message || 'no_se_pudo_reenviar'}`);
    }
    setMenuRow(null); setMenuAnchor(null);
  };

  const handleRevoke = async (m) => {
    if (!window.confirm(`¿Revocar acceso de "${m.alias || m.email}" a este negocio?`)) {
      setMenuRow(null); setMenuAnchor(null);
      return;
    }
    try {
      await revokeAssignment(m.id);
      try { window.dispatchEvent(new CustomEvent('team:changed')); } catch { }
      fetchMembers();
    } catch (e) {
      alert(`Error: ${e?.message || 'no_se_pudo_revocar'}`);
    }
    setMenuRow(null); setMenuAnchor(null);
  };

  // La vista de equipo es consolidada (todos los negocios), no depende del negocio activo.

  return (
    <>
      <Section
        icon={<GroupsIcon />}
        title="Equipo"
        badge={members.length ? `${members.length} ${members.length === 1 ? 'persona' : 'personas'}` : undefined}
        action={
          puedeGestionar ? (
            <Tooltip title="Invitar miembro">
              <IconButton
                size="small"
                onClick={() => setShowInvite(true)}
                sx={{ color: tc }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null
        }
      >
        {loading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={24} />
          </Stack>
        ) : error ? (
          <Typography variant="body2" color="error">{error}</Typography>
        ) : members.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} py={2}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '50%',
              bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GroupsIcon sx={{ fontSize: 26, color: '#cbd5e1' }} />
            </Box>
            <Stack alignItems="center" spacing={0.5}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Todavía no invitaste a nadie
              </Typography>
              {puedeGestionar && (
                <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ maxWidth: 340 }}>
                  Sumá administradores o staff para que te ayuden a gestionar el negocio.
                </Typography>
              )}
            </Stack>
            {puedeGestionar && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowInvite(true)}
                sx={{ mt: 0.5, borderRadius: 1.6 }}
              >
                Invitar miembro
              </Button>
            )}
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Alias', 'Email', 'Rol', 'Negocios', 'Estado', ''].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map(m => {
                const estaInvitado = m.account_status === 'invited';
                const unSoloNegocio = m.negocios.length === 1;
                const expandido = expandedEmail === m.email;
                return (
                  <React.Fragment key={m.email}>
                    <TableRow>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width: 26, height: 26, fontSize: '0.72rem', bgcolor: tc }}>
                            {(m.alias || m.name || m.email || 'U')[0].toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600}>
                            {m.alias || m.name || '—'}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                        {m.email}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={m.rolMasAlto}
                          size="small"
                          icon={<AdminPanelSettingsIcon sx={{ fontSize: '0.8rem !important' }} />}
                          sx={{ fontSize: '0.7rem', bgcolor: `${tc}15`, color: tc, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        {unSoloNegocio ? (
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {m.negocios[0].scopeName}
                          </Typography>
                        ) : (
                          <Chip
                            label={`${m.negocios.length} negocios`}
                            size="small"
                            variant="outlined"
                            onClick={() => setExpandedEmail(expandido ? null : m.email)}
                            sx={{ fontSize: '0.7rem', cursor: 'pointer', borderColor: tc, color: tc }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={estaInvitado ? 'Invitación pendiente' : 'Activo'}
                          size="small"
                          color={estaInvitado ? 'warning' : 'success'}
                          variant={estaInvitado ? 'outlined' : 'filled'}
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {puedeGestionar && (
                          <IconButton
                            size="small"
                            onClick={(e) => { setMenuRow(m); setMenuAnchor(e.currentTarget); }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    {/* Detalle expandible de negocios cuando hay más de uno */}
                    {!unSoloNegocio && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ py: 0, borderBottom: expandido ? undefined : 'none' }}>
                          <Collapse in={expandido} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1, pl: 5 }}>
                              <Stack spacing={0.75}>
                                {m.negocios.map(n => (
                                  <Stack key={n.assignmentId ?? `${n.scopeType}-${n.scopeId}`}
                                    direction="row" alignItems="center" spacing={1}>
                                    <BusinessIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                      {n.scopeName}
                                    </Typography>
                                    <Chip label={n.role} size="small"
                                      sx={{ height: 18, fontSize: '0.62rem', bgcolor: `${tc}12`, color: tc }} />
                                  </Stack>
                                ))}
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

{/* Menú contextual */}
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => { setMenuAnchor(null); setMenuRow(null); }}
      >
        <MenuItem onClick={() => {
          setEditandoPersona(menuRow);
          setMenuAnchor(null); setMenuRow(null);
        }}>
          <ManageAccountsOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
          Editar acceso
        </MenuItem>
        {menuRow?.account_status === 'invited' && menuRow?.negocios?.[0]?.assignmentId && (
          <MenuItem onClick={() => handleResend(menuRow.negocios[0].assignmentId)}>
            <RefreshIcon fontSize="small" sx={{ mr: 1 }} />
            Reenviar invitación
          </MenuItem>
        )}
      </Menu>

      {/* Modal editar acceso */}
      <EditarAccesoModal
        open={!!editandoPersona}
        persona={editandoPersona}
        onClose={() => setEditandoPersona(null)}
        onChanged={fetchMembers}
      />

      {/* Modal invitar */}
      <InvitarMiembroModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        scopeType="business"
        scopeId={bizId}
        scopeName={bizName}
        onCreated={(res) => {
          fetchMembers();
          if (res?.successMessage) setSnack(res.successMessage);
        }}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        message={snack || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

/* ─── Seguridad placeholder ─── */
function SecuritySection() {
  return (
    <Section icon={<LockOutlinedIcon />} title="Seguridad" badge="Próximamente">
      <Stack spacing={1.5}>
        {[
          { label: 'Contraseña', desc: 'Cambiá tu contraseña de acceso' },
          { label: 'Autenticación de dos factores', desc: 'Protegé tu cuenta con un segundo factor' },
          { label: 'Sesiones activas', desc: 'Cerrá sesiones en otros dispositivos' },
        ].map(({ label, desc }) => (
          <Stack key={label} direction="row" alignItems="center" justifyContent="space-between"
            sx={{ py: 1, '& + &': { borderTop: '1px solid #f3f4f6' } }}>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{desc}</Typography>
            </Box>
            <Button size="small" variant="outlined" disabled
              sx={{ fontSize: '0.75rem', borderRadius: 1.5, minWidth: 80 }}>
              Próximo
            </Button>
          </Stack>
        ))}
      </Stack>
    </Section>
  );
}

/* ═══════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════ */
function PerfilContenido() {
  const { organization } = useOrganization() || {};
  const { items, refetchBusinesses } = useBusiness() || {};
  const { currentRole, highestRole } = useAccess() || {};
  const sinNegocios = !items || items.length === 0;
  const [showCreateBiz, setShowCreateBiz] = React.useState(false);

  const { user, setUser } = useAuth();

  const me = useMemo(() => {
    if (user) return user;
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, [user]);

  // Prioridad: display_name personal > name del owner > primer/último nombre > 'Usuario'
  const meName = me?.display_name
    || me?.name
    || [me?.firstName, me?.lastName].filter(Boolean).join(' ')
    || 'Usuario';

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', type: 'success' });

  const openRename = useCallback(() => {
    setRenameValue(me?.display_name || me?.name || '');
    setRenameOpen(true);
  }, [me]);

  const ejecutarRename = useCallback(async () => {
    const nuevo = renameValue.trim();
    if (!nuevo || nuevo.length < 2) {
      setSnack({ open: true, msg: 'Ingresá al menos 2 caracteres', type: 'error' });
      return;
    }
    setRenaming(true);
    try {
      const updated = await MeAPI.updateMe({ displayName: nuevo });
      // updated viene del backend con los campos nuevos
      const newUser = { ...me, ...updated, display_name: updated?.display_name ?? nuevo };
      setUser?.(newUser);
      try { localStorage.setItem('user', JSON.stringify(newUser)); } catch { }
      setSnack({ open: true, msg: 'Nombre actualizado', type: 'success' });
      setRenameOpen(false);
    } catch (e) {
      console.error('RENAME_PROFILE_ERROR', e);
      setSnack({ open: true, msg: 'No se pudo actualizar el nombre', type: 'error' });
    } finally {
      setRenaming(false);
    }
  }, [renameValue, me, setUser]);

  const userInitials = meName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  // Rol mostrado en el perfil: el MÁS ALTO entre todos los negocios (estable, no cambia
  // al switchear de negocio). El perfil es una vista global del usuario, no del negocio activo.
  const rolPerfil = highestRole || currentRole;
  const roleLabel = rolPerfil === 'admin' ? 'Administrador'
    : rolPerfil === 'owner' ? 'Propietario'
      : rolPerfil === 'staff' ? 'Staff'
        : 'Usuario';

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 3 } }}>

      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
        <PersonIcon sx={{ color: tc, fontSize: 26 }} />
        <Typography variant="h5" fontWeight={800}>Mi perfil</Typography>
      </Stack>

      <Stack spacing={2.5}>

        {/* ── Card usuario ── */}
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
          {/* Banda superior */}
          <Box sx={{ height: 5, bgcolor: tc }} />

          <Box sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'flex-start' }}>
              {/* Avatar */}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar sx={{
                  width: 80, height: 80, fontSize: '1.75rem', fontWeight: 700, bgcolor: tc,
                }}>
                  {userInitials || <PersonIcon />}
                </Avatar>
                <Tooltip title="Cambiar foto (próximamente)">
                  <span>
                    <IconButton size="small" disabled sx={{
                      position: 'absolute', bottom: -2, right: -2,
                      bgcolor: '#fff', border: '1px solid #e2e8f0', width: 24, height: 24,
                    }}>
                      <EditOutlinedIcon sx={{ fontSize: 13 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Datos */}
              <Stack spacing={0.5} sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                  <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                    {meName}
                  </Typography>
                  <Tooltip title="Editar nombre">
                    <IconButton size="small" onClick={openRename} sx={{ p: 0.5, color: tc }}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {rolPerfil && (
                    <Chip label={roleLabel} size="small"
                      icon={<BadgeOutlinedIcon sx={{ fontSize: '0.75rem !important' }} />}
                      sx={{ fontSize: '0.68rem', height: 20, bgcolor: `${tc}12`, color: tc, border: `1px solid ${tc}25` }} />
                  )}
                </Stack>

                {me?.email && (
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {me.email}
                    </Typography>
                  </Stack>
                )}

                {organization?.name && (
                  <Stack direction="row" alignItems="center" spacing={0.75} mt={0.25}>
                    <BusinessIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {organization.name}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Box>
        </Paper>

        {/* ── Crear primer negocio (solo cuando no hay ninguno) ── */}
        {sinNegocios && (
          <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
            <Box sx={{ height: 4, bgcolor: 'warning.main' }} />
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                ¡Creá tu primer negocio!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 380, mx: 'auto' }}>
                Todavía no tenés ningún negocio configurado. Creá uno para empezar a gestionar artículos, precios y ventas.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateBiz(true)}
                sx={{
                  px: 4, py: 1.25, borderRadius: 2, fontWeight: 700,
                  bgcolor: 'var(--color-primary, #3b82f6)',
                  '&:hover': { filter: 'brightness(0.9)', bgcolor: 'var(--color-primary, #3b82f6)' },
                }}>
                Crear mi primer negocio
              </Button>
            </Box>
          </Paper>
        )}

        <BusinessCreateModal
          open={showCreateBiz}
          onClose={() => setShowCreateBiz(false)}
          onCreateComplete={async (biz) => {
            setShowCreateBiz(false);
            await refetchBusinesses?.();
            if (biz?.id) {
              const bizId = Number(biz.id);
              try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: bizId } })); } catch { }
              try {
                const maxiOk = await isMaxiConfigured(bizId);
                if (maxiOk) {
                  window.dispatchEvent(new CustomEvent('sync:start', { detail: { bizId } }));
                  const result = await syncAll(bizId, {
                    onProgress: (msg, type, step) => {
                      window.dispatchEvent(new CustomEvent('sync:progress', { detail: { msg, type, step } }));
                    },
                  });
                  window.dispatchEvent(new CustomEvent('sync:completed', { detail: { bizId, ok: !!result?.ok } }));
                  try { await ensureTodo(bizId); } catch { }
                }
              } catch { }
            }
          }}
        />

        <Section icon={<PersonIcon />} title="Información personal"
        >
          <Stack divider={<Divider flexItem />}>
            <DataRow label="Nombre" value={meName} />
            <DataRow label="Email" value={me?.email} />
            <DataRow label="Rol" value={roleLabel} />
            {organization?.name && <DataRow label="Organización" value={organization.name} />}
          </Stack>
        </Section>

        {/* ── Equipo (FUNCIONAL) ── */}
        <TeamSection />

        {/* ── Seguridad ── */}
        <SecuritySection />

      </Stack>
      {/* Diálogo editar nombre */}
      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>Editar tu nombre</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <TextField
            autoFocus fullWidth size="small"
            label="¿Cómo te llamás?"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ejecutarRename(); }}
            helperText="Así aparecerá tu nombre en Lazarillo"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)} disabled={renaming}>Cancelar</Button>
          <Button onClick={ejecutarRename} variant="contained" disabled={renaming || !renameValue.trim()}>
            {renaming ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <div style={{ background: snack.type === 'error' ? '#dc2626' : '#16a34a', color: 'white', padding: '8px 16px', borderRadius: 8, fontSize: '0.85rem' }}>
          {snack.msg}
        </div>
      </Snackbar>
    </Box>
  );
}

/* ═══════════════════════════════════════
   WRAPPER — decide asistente vs. perfil
═══════════════════════════════════════ */
export default function Perfil() {
  const { items, refetchBusinesses } = useBusiness() || {};
  const navigate = useNavigate();
  const sinNegocios = !items || items.length === 0;

  // Opción B: usuario sin negocios → asistente de onboarding a pantalla completa.
  // El asistente crea el negocio y persiste artículos/insumos; al terminar
  // refrescamos la lista y entramos a la app.
  if (sinNegocios) {
    return (
      <AsistenteOnboarding
        onDone={async () => {
          try { await refetchBusinesses?.(); } catch { }
          navigate('/menu');
        }}
      />
    );
  }

  return <PerfilContenido />;
}