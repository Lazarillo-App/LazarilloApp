/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { syncAll, isMaxiConfigured } from '@/servicios/syncService';
import { ensureTodo } from '../servicios/apiAgrupacionesTodo';

import BusinessCard from '../componentes/BusinessCard';
import BusinessCreateModal from '../componentes/BusinessCreateModal';
import BusinessEditModal from '../componentes/BusinessEditModal';
import SyncDialog from '../componentes/SyncDialog';
import OrgDashboard from '../componentes/OrgDashboard';
import SucursalesSection from '../componentes/SucursalesSection';

import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { useBusiness } from '@/context/BusinessContext';
import { useOrganization } from '@/context/OrganizationContext';

import {
  Box, Stack, Typography, Avatar, Chip, Button,
  Paper, Skeleton, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import GroupsIcon from '@mui/icons-material/Groups';
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

/* ── Placeholder equipo — se completará cuando exista el endpoint ── */
function TeamSection() {
  // TODO: fetch `/api/org/members` cuando esté disponible
  const members = []; // vacío por ahora → muestra estado vacío

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Stack
        direction="row" alignItems="center" justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <GroupsIcon sx={{ color: 'var(--color-primary)', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Equipo
          </Typography>
          <Chip
            label="Próximamente"
            size="small"
            sx={{ fontSize: '0.65rem', height: 18, bgcolor: '#f1f5f9', color: '#64748b' }}
          />
        </Stack>
        <Tooltip title="Invitar miembro (próximamente)">
          <span>
            <IconButton size="small" disabled>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Box sx={{ px: 2.5, py: 3 }}>
        {members.length === 0 ? (
          <Stack alignItems="center" spacing={1} py={2}>
            <GroupsIcon sx={{ fontSize: 40, color: '#e2e8f0' }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Aquí vas a ver los miembros de tu equipo que tienen acceso a este negocio.
              <br />
              Próximamente podés invitar colaboradores con distintos roles.
            </Typography>
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Usuario</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Rol</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'var(--color-primary)' }}>
                        {(m.name || 'U')[0].toUpperCase()}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{m.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={m.role}
                      size="small"
                      icon={<AdminPanelSettingsIcon sx={{ fontSize: '0.8rem !important' }} />}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={m.active ? 'Activo' : 'Invitado'}
                      size="small"
                      color={m.active ? 'success' : 'default'}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Paper>
  );
}

/* ── Página principal ── */
export default function Perfil() {
  const {
    items,
    active,
    activeId,
    selectBusiness,
    selectDivision,
    refetchBusinesses,
    removeBusinessFromState,
    loading: businessesLoading,
  } = useBusiness() || {};

  const { organization, allBusinesses } = useOrganization() || {};

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState({ open: false, title: '', message: '' });

  const showNotice = (title, message) => setNotice({ open: true, title, message });
  const closeNotice = () => setNotice((s) => ({ ...s, open: false }));

  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') || {}; }
    catch { return {}; }
  }, []);

  const newLocalBtnRef = useRef(null);

  useEffect(() => { refetchBusinesses?.(); }, [refetchBusinesses]);

  const onCreateComplete = async (biz) => {
    setShowCreate(false);
    const bizId = Number(biz?.id);
    if (!Number.isFinite(bizId) || bizId <= 0) {
      await refetchBusinesses?.();
      try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: biz?.id } })); } catch { }
      return;
    }
    await refetchBusinesses?.();
    const isSubBusiness = biz.created_from === 'from_group';
    if (!isSubBusiness) {
      try {
        const maxiOk = await isMaxiConfigured(bizId);
        if (maxiOk) {
          window.dispatchEvent(new CustomEvent('sync:start', { detail: { bizId } }));
          showNotice('Sincronizando datos', 'Iniciando sincronización automática…');
          const result = await syncAll(bizId, {
            onProgress: (msg, type, step) => {
              window.dispatchEvent(new CustomEvent('sync:progress', { detail: { msg, type, step } }));
            },
          });
          if (result?.ok) {
            showNotice('Sincronización completa', 'Artículos e insumos sincronizados correctamente');
            try { await ensureTodo(bizId); } catch { }
          } else {
            const errors = Array.isArray(result?.errors) ? result.errors : [];
            const errorSteps = errors.map((e) => e.step).filter(Boolean).join(', ') || 'desconocido';
            showNotice('Sincronización parcial', `Completado con errores en: ${errorSteps}`);
          }
          window.dispatchEvent(new CustomEvent('sync:completed', { detail: { bizId, ok: !!result?.ok } }));
        } else {
          showNotice('Negocio creado', 'Configurá las credenciales de Maxi para habilitar la sincronización automática');
        }
      } catch (e) {
        showNotice('Error', 'No se pudo completar la sincronización automática');
        window.dispatchEvent(new CustomEvent('sync:completed', { detail: { bizId, ok: false } }));
      }
    } else {
      showNotice('Sub-negocio creado', `"${biz.name}" fue creado correctamente y hereda las credenciales del principal.`);
    }
    try { window.dispatchEvent(new CustomEvent('business:created', { detail: { id: bizId } })); } catch { }
  };

  const handleDeleteBusiness = async (biz) => {
    const id = biz?.id;
    if (!id) return;
    const name = biz?.name || biz?.nombre || `#${id}`;
    const ok = window.confirm(`¿Eliminar el local "${name}"?\nEsta acción no se puede deshacer.`);
    if (!ok) return;
    try { newLocalBtnRef.current?.focus?.(); } catch { try { document.activeElement?.blur?.(); } catch { } }
    try {
      const currentActiveId = Number(activeId);
      const deletedId = Number(id);
      const isActive = currentActiveId === deletedId;
      await BusinessesAPI.remove(id);
      removeBusinessFromState?.(id);
      if (isActive) {
        const businesses = await BusinessesAPI.listMine();
        if (businesses && businesses.length > 0) {
          const newBiz = businesses[0];
          await BusinessesAPI.setActive(newBiz.id);
          window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: newBiz.id, biz: newBiz } }));
          showNotice('Listo', `🗑️ Local eliminado. Ahora activo: "${newBiz.name}"`);
        } else {
          localStorage.removeItem('activeBusinessId');
          await selectBusiness?.(null);
          await selectDivision?.(null);
          window.dispatchEvent(new CustomEvent('business:switched', { detail: { bizId: null, biz: null } }));
          showNotice('Listo', '🗑️ Local eliminado. No quedan más locales.');
        }
      } else {
        showNotice('Listo', `🗑️ Local "${name}" eliminado`);
      }
      await refetchBusinesses?.();
      window.dispatchEvent(new CustomEvent('business:deleted', { detail: { id } }));
    } catch (e) {
      showNotice('Error', e?.message || 'No se pudo eliminar el local');
    }
  };

  const activeBiz = active || null;
  const list = Array.isArray(items) ? items : [];
  const meName = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.name || 'Usuario';
  const userInitials = meName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const orgBizIds = new Set((allBusinesses || []).map((b) => String(b.id)));
  const outsideOrg = organization && orgBizIds.size > 1
    ? list.filter((b) => !orgBizIds.has(String(b.id)))
    : list;

  const themeColor = 'var(--color-primary, #3b82f6)';

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', p: { xs: 2, md: 3 } }}>

      {/* ── Header: datos del usuario ── */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          mb: 3,
        }}
      >
        {/* Banda de color superior */}
        <Box sx={{ height: 6, bgcolor: themeColor }} />

        <Box sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }}>
            {/* Avatar */}
            <Avatar
              sx={{
                width: 72,
                height: 72,
                fontSize: '1.5rem',
                fontWeight: 700,
                bgcolor: themeColor,
                flexShrink: 0,
              }}
            >
              {userInitials || <PersonIcon />}
            </Avatar>

            {/* Info */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800} lineHeight={1.2} mb={0.5}>
                {meName}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" gap={0.5}>
                {me?.email && (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {me.email}
                    </Typography>
                  </Stack>
                )}
                {organization?.name && (
                  <>
                    <Typography variant="caption" color="text.disabled">·</Typography>
                    <Chip
                      size="small"
                      label={organization.name}
                      icon={<BusinessIcon sx={{ fontSize: '0.75rem !important' }} />}
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  </>
                )}
              </Stack>
            </Box>

            {/* CTA */}
            <Button
              ref={newLocalBtnRef}
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setShowCreate(true)}
              sx={{
                bgcolor: themeColor,
                flexShrink: 0,
                '&:hover': { filter: 'brightness(0.9)', bgcolor: themeColor },
              }}
            >
              Nuevo local
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* ── Organización (si aplica) ── */}
      {organization && (allBusinesses || []).length > 1 && (
        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
          <Stack
            direction="row" alignItems="center" spacing={1}
            sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <BusinessIcon sx={{ color: themeColor, fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Mi organización — {organization.name || 'Sin nombre'}
            </Typography>
          </Stack>
          <Box sx={{ p: 2 }}>
            <OrgDashboard
              compact
              onSelectBusiness={async (biz) => {
                try { await selectBusiness?.(biz.id); } catch { }
              }}
            />
          </Box>
        </Paper>
      )}

      {/* ── Mis locales ── */}
      {!(outsideOrg.length === 0 && organization && orgBizIds.size > 1) && (
        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
          <Stack
            direction="row" alignItems="center" justifyContent="space-between"
            sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <BusinessIcon sx={{ color: themeColor, fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={700}>Mis locales</Typography>
              {list.length > 0 && (
                <Chip
                  size="small"
                  label={outsideOrg.length}
                  sx={{ fontSize: '0.65rem', height: 18, bgcolor: `${themeColor}18`, color: themeColor, fontWeight: 700 }}
                />
              )}
            </Stack>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowCreate(true)}
              sx={{ borderColor: themeColor, color: themeColor, fontSize: '0.75rem' }}
            >
              Nuevo
            </Button>
          </Stack>

          <Box sx={{ p: 2 }}>
            {businessesLoading ? (
              <Stack spacing={1.5}>
                {[1, 2].map((n) => <Skeleton key={n} variant="rounded" height={80} />)}
              </Stack>
            ) : outsideOrg.length === 0 ? (
              <Box sx={{ border: '1px dashed #e5e7eb', borderRadius: 2, p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Aún no tenés locales. Creá el primero.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {outsideOrg.map((biz) => (
                  <BusinessCard
                    key={biz.id}
                    biz={biz}
                    activeId={activeId}
                    onEdit={setEditing}
                    onDelete={handleDeleteBusiness}
                    showNotice={(msg) => showNotice('Aviso', msg)}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* ── Sucursales ── */}
      {activeId && (
        <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
          <Stack
            direction="row" alignItems="center" spacing={1}
            sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <BusinessIcon sx={{ color: themeColor, fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Sucursales
              {activeBiz?.name && (
                <Typography component="span" variant="caption" color="text.secondary" ml={0.75}>
                  de {activeBiz.name}
                </Typography>
              )}
            </Typography>
          </Stack>
          <Box sx={{ p: 2 }}>
            <SucursalesSection />
          </Box>
        </Paper>
      )}

      {/* ── Equipo (adelantado) ── */}
      <TeamSection />

      {/* ── Modals ── */}
      <BusinessCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreateComplete={onCreateComplete}
      />
      <BusinessEditModal
        open={!!editing}
        business={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refetchBusinesses?.();
          try { window.dispatchEvent(new Event('business:updated')); } catch { }
        }}
      />
      <SyncDialog
        open={notice.open}
        title={notice.title}
        message={notice.message}
        onClose={closeNotice}
      />
    </Box>
  );
}