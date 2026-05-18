/* eslint-disable no-empty */
// src/paginas/Perfil.jsx
import React, { useMemo } from 'react';
import {
  Box, Stack, Typography, Avatar, Chip, Button, Paper,
  Divider, IconButton, Tooltip, Table, TableHead,
  TableRow, TableCell, TableBody,
} from '@mui/material';
import PersonIcon            from '@mui/icons-material/Person';
import EmailIcon             from '@mui/icons-material/Email';
import GroupsIcon            from '@mui/icons-material/Groups';
import AddIcon               from '@mui/icons-material/Add';
import BusinessIcon          from '@mui/icons-material/Business';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockOutlinedIcon      from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon      from '@mui/icons-material/EditOutlined';
import BadgeOutlinedIcon     from '@mui/icons-material/BadgeOutlined';
import { useOrganization }   from '@/context/OrganizationContext';
import { useBusiness }       from '@/context/BusinessContext';
import BusinessCreateModal   from '@/componentes/BusinessCreateModal';
import { syncAll, isMaxiConfigured } from '@/servicios/syncservice';
import { ensureTodo } from '@/servicios/apiAgrupacionesTodo';

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

/* ─── Equipo placeholder ─── */
function TeamSection() {
  const members = [];
  return (
    <Section
      icon={<GroupsIcon />}
      title="Equipo"
      badge="Próximamente"
      action={
        <Tooltip title="Invitar miembro (próximamente)">
          <span>
            <IconButton size="small" disabled><AddIcon fontSize="small" /></IconButton>
          </span>
        </Tooltip>
      }
    >
      {members.length === 0 ? (
        <Stack alignItems="center" spacing={1.5} py={2}>
          <Box sx={{
            width: 52, height: 52, borderRadius: '50%',
            bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GroupsIcon sx={{ fontSize: 26, color: '#cbd5e1' }} />
          </Box>
          <Stack alignItems="center" spacing={0.5}>
            <Typography variant="body2" fontWeight={600} color="text.secondary">
              Aún no hay equipo configurado
            </Typography>
            <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ maxWidth: 340 }}>
              Próximamente podrás invitar colaboradores con distintos roles y permisos a tu negocio.
            </Typography>
          </Stack>
        </Stack>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Usuario', 'Email', 'Rol', 'Estado'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map(m => (
              <TableRow key={m.id}>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar sx={{ width: 26, height: 26, fontSize: '0.72rem', bgcolor: tc }}>
                      {(m.name || 'U')[0].toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{m.email}</TableCell>
                <TableCell>
                  <Chip label={m.role} size="small"
                    icon={<AdminPanelSettingsIcon sx={{ fontSize: '0.8rem !important' }} />}
                    sx={{ fontSize: '0.7rem' }} />
                </TableCell>
                <TableCell>
                  <Chip label={m.active ? 'Activo' : 'Invitado'} size="small"
                    color={m.active ? 'success' : 'default'} sx={{ fontSize: '0.7rem' }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
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
export default function Perfil() {
  const { organization } = useOrganization() || {};
  const { items, refetchBusinesses } = useBusiness() || {};
  const sinNegocios = !items || items.length === 0;
  const [showCreateBiz, setShowCreateBiz] = React.useState(false);

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, []);

  const meName      = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.name || 'Usuario';
  const userInitials = meName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel   = me?.role === 'admin' ? 'Administrador'
    : me?.role === 'owner' ? 'Propietario'
    : me?.role === 'staff' ? 'Staff'
    : me?.role || 'Usuario';

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
                  {me?.role && (
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
              try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: bizId } })); } catch {}
              // Sync automático si Maxi está configurado
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
                  try { await ensureTodo(bizId); } catch {}
                }
              } catch {}
            }
          }}
        />
        <Section icon={<PersonIcon />} title="Información personal"
          action={
            <Tooltip title="Editar perfil (próximamente)">
              <span>
                <IconButton size="small" disabled>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        >
          <Stack divider={<Divider flexItem />}>
            <DataRow label="Nombre" value={meName} />
            <DataRow label="Email" value={me?.email} />
            <DataRow label="Rol" value={roleLabel} />
            {organization?.name && <DataRow label="Organización" value={organization.name} />}
          </Stack>
        </Section>

        {/* ── Equipo ── */}
        <TeamSection />

        {/* ── Seguridad ── */}
        <SecuritySection />

      </Stack>
    </Box>
  );
}