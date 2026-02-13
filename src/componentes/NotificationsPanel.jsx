/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/componentes/NotificationsPanel.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Typography,
  Button,
  Divider,
  Box,
  ListItemButton,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';

import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import { useBusiness } from '@/context/BusinessContext';
import { useNotifications } from '../hooks/useNotifications';
import { http } from '../servicios/apiBusinesses';
import { emitUiUndo } from '@/servicios/uiEvents';
import CloseIcon from '@mui/icons-material/Close';

/* =========================
   API helpers (sync change-sets)
========================= */
async function apiGetChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}`);
}
async function apiApproveChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}/approve`, { method: 'POST' });
}
async function apiRejectChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}/reject`, { method: 'POST' });
}
async function apiApplyChangeSet(businessId, changeSetId) {
  return http(`/businesses/${businessId}/sync/change-sets/${changeSetId}/apply`, { method: 'POST' });
}

/* ========= helpers ========= */
function pickChangeSetId(notif) {
  const raw = notif?.metadata?.change_set_id ?? notif?.meta?.change_set_id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  if (!Number.isFinite(diff)) return '';
  if (diff < 60000) return 'Hace un momento';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} hs`;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function NotificationsPanel({ businessId: businessIdProp }) {
  const { activeBusinessId } = useBusiness() || {};
  const businessId = Number(businessIdProp ?? activeBusinessId) || null;

  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    refreshCount,
    refreshAll,
    markAsRead,
    markAllAsRead,
    patchNotification,
  } = useNotifications({ businessId });

  const [rowBusy, setRowBusy] = useState({});
  const [uiNotifs, setUiNotifs] = useState([]); // UI notifs capturadas por eventos

  /* =========================
     ✅ Persistencia + DEDUPE UI
  ========================= */
  const UI_KEY = useCallback((bid) => `lazarillo:uiNotifs:${bid || 'na'}`, []);

  // cargar persistido por negocio
  useEffect(() => {
    if (!businessId) return;
    try {
      const raw = localStorage.getItem(UI_KEY(businessId));
      if (!raw) {
        setUiNotifs([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setUiNotifs(parsed);
      else setUiNotifs([]);
    } catch {
      setUiNotifs([]);
    }
  }, [businessId, UI_KEY]);

  // persistir cambios
  useEffect(() => {
    if (!businessId) return;
    try {
      localStorage.setItem(UI_KEY(businessId), JSON.stringify(uiNotifs || []));
    } catch { }
  }, [uiNotifs, businessId, UI_KEY]);

  // 1) Escuchar eventos globales ui:action (con dedupe)
  useEffect(() => {
    const makeSig = (d) => {
      const ids = (d?.payload?.ids || [])
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)
        .join(',');

      return [
        d?.kind || '',
        d?.scope || d?.payload?.scope || '',
        ids,
        d?.title || '',
        d?.message || '',
        String(d?.payload?.originId ?? d?.payload?.originGroupId ?? ''),
        String(d?.payload?.toId ?? ''),
      ].join('|');
    };

    const onUiAction = (e) => {
      const d = e?.detail;
      if (!d) return;

      // filtrar negocio (si viene businessId en el evento)
      if (businessId && d.businessId && Number(d.businessId) !== Number(businessId)) return;

      // ✅ scope por defecto coherente con tu pantalla de artículos
      const scope = d.scope ?? d.payload?.scope ?? (d.kind === 'discontinue' ? 'articulo' : null);

      // ✅ actionId: si no viene, NO pasa nada: dedupe por firma+ventana
      const actionId = d.actionId || d.id || null;
      const sig = makeSig(d);

      const item = {
        id: actionId
          ? `ui:${actionId}`
          : `ui:${Date.now()}:${Math.random().toString(16).slice(2)}`,
        _actionId: actionId,
        _sig: sig,

        source: 'ui',
        read: false,
        kind: d.kind,
        scope,
        businessId: d.businessId ?? businessId ?? null,
        title: d.title || 'Notificación',
        message: d.message || '',
        created_at: d.createdAt || new Date().toISOString(),
        payload: d.payload || {},
        resolved: false,
      };

      setUiNotifs((prev) => {
        const arr = Array.isArray(prev) ? prev : [];

        // ✅ 1) dedupe fuerte por actionId si existe
        if (actionId && arr.some((n) => n?._actionId === actionId)) return arr;

        // ✅ 2) dedupe por firma en ventana corta (evita doble dispatch)
        const now = Date.now();
        const repeated = arr.find((n) => {
          if (!n?._sig || n._sig !== sig) return false;
          const t = new Date(n.created_at).getTime();
          return Number.isFinite(t) && now - t < 2000; // 2s
        });
        if (repeated) return arr;

        // ✅ mantené historial (no “desaparece” tan rápido)
        return [item, ...arr].slice(0, 200);
      });
    };

    window.addEventListener('ui:action', onUiAction);
    return () => window.removeEventListener('ui:action', onUiAction);
  }, [businessId]);

  const setBusy = useCallback((notifId, actionOrNull) => {
    setRowBusy((prev) => {
      const next = { ...prev };
      if (!actionOrNull) delete next[notifId];
      else next[notifId] = actionOrNull;
      return next;
    });
  }, []);

  // 2) Al abrir panel, traer backend list+count
  useEffect(() => {
    if (!open) return;
    refreshAll?.();
  }, [open, refreshAll]);

  // 3) Auto-refresh backend mientras esté abierto
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      refresh?.();
      refreshCount?.();
    }, 15000);
    return () => clearInterval(t);
  }, [open, refresh, refreshCount]);

  const safeRefreshAfterAction = useCallback(async () => {
    await refreshCount?.();
    await refresh?.();
    try { window.dispatchEvent(new CustomEvent('sync:completed')); } catch { }
  }, [refresh, refreshCount]);

  const onNotifClick = useCallback(async (notif) => {
    if (!notif?.read && !notif?.metadata?.resolution?.status) {
      try { await markAsRead([notif.id]); } catch { }
    }
  }, [markAsRead]);

  const getIcon = (notif) => {
    // UI notifs
    if (notif?.source === 'ui') {
      const kind = notif.kind;

      // Artículos/Insumos discontinuados
      if (kind === 'discontinue') return '⛔';

      // Agrupaciones
      if (kind === 'group_create') return '🆕';
      if (kind === 'group_delete') return '🗑️';
      if (kind === 'group_rename') return '✏️';
      if (kind === 'group_move_division') return '🔀';
      if (kind === 'group_favorite_set') return '⭐';
      if (kind === 'group_favorite_unset') return '☆';

      // Movimientos entre agrupaciones
      if (kind === 'move') return '📦';

      return '📌';
    }

   
  };

  // ✅ MEJORA: Helper para formatear el título según scope
  const formatTitle = (notif) => {
    const scope = notif?.scope || notif?.payload?.scope || 'articulo';
    const scopeLabel = scope === 'insumo' ? 'Insumo' : 'Artículo';

    const kind = notif?.kind;

    if (kind === 'group_favorite_set') return `⭐ Marcada como favorita`;
    if (kind === 'group_favorite_unset') return `☆ Desmarcada como favorita`;
    if (kind === 'group_create') return `🆕 Nueva agrupación`;
    if (kind === 'group_delete') return `🗑️ Agrupación eliminada`;
    if (kind === 'group_rename') return `✏️ Agrupación renombrada`;
    if (kind === 'group_move_division') return `🔀 Enviada a división`;
    if (kind === 'discontinue') return `⛔ ${scopeLabel}${notif.payload?.ids?.length > 1 ? 's' : ''} discontinuado${notif.payload?.ids?.length > 1 ? 's' : ''}`;
    if (kind === 'move') return `📦 ${scopeLabel}${notif.payload?.ids?.length > 1 ? 's' : ''} movido${notif.payload?.ids?.length > 1 ? 's' : ''}`;

    return notif?.title || 'Notificación';
  };

  const rejectInline = useCallback(async (notif) => {
    const csId = pickChangeSetId(notif);
    if (!businessId || !csId) return;

    setBusy(notif.id, 'reject');

    patchNotification?.(notif.id, {
      read: true,
      metadata: { resolution: { status: 'rejected', at: new Date().toISOString(), change_set_id: String(csId) } },
    });

    try {
      await apiRejectChangeSet(businessId, csId);
      await safeRefreshAfterAction();
    } catch (e) {
      patchNotification?.(notif.id, { read: false, metadata: { resolution: null } });
      await safeRefreshAfterAction();
    } finally {
      setBusy(notif.id, null);
    }
  }, [businessId, patchNotification, safeRefreshAfterAction, setBusy]);

  const acceptAndApplyInline = useCallback(async (notif) => {
    const csId = pickChangeSetId(notif);
    if (!businessId || !csId) return;

    setBusy(notif.id, 'apply');

    patchNotification?.(notif.id, {
      read: true,
      metadata: { resolution: { status: 'applied', at: new Date().toISOString(), change_set_id: String(csId) } },
    });

    try {
      const cs = await apiGetChangeSet(businessId, csId);
      const status = String(cs?.item?.status || '');

      if (status === 'applied' || status === 'rejected') {
        await safeRefreshAfterAction();
        return;
      }
      if (status === 'pending' || status === 'error') {
        await apiApproveChangeSet(businessId, csId);
      }
      await apiApplyChangeSet(businessId, csId);
      await safeRefreshAfterAction();
    } catch (e) {
      patchNotification?.(notif.id, { read: false, metadata: { resolution: null } });
      await safeRefreshAfterAction();
    } finally {
      setBusy(notif.id, null);
    }
  }, [businessId, patchNotification, safeRefreshAfterAction, setBusy]);

  // 4) Merge UI + backend
  const merged = useMemo(() => {
    const ui = (uiNotifs || []).filter((n) => !n.resolved);
    const back = (notifications || []).filter((n) => !businessId || Number(n.business_id) === Number(businessId));
    return [...ui, ...back];
  }, [uiNotifs, notifications, businessId]);

  const unreadUiCount = useMemo(
    () => (uiNotifs || []).filter((n) => !n.read && !n.resolved).length,
    [uiNotifs]
  );
  const badgeCount = (Number(unreadCount || 0) + Number(unreadUiCount || 0));

  const markAllUiAsRead = () => {
    setUiNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const undoUiNotif = async (uiNotif) => {
    emitUiUndo({
      kind: uiNotif.kind,
      scope: uiNotif.scope,
      businessId: uiNotif.businessId || businessId,
      payload: uiNotif.payload,
    });

    setUiNotifs((prev) =>
      prev.map((n) => (n.id === uiNotif.id ? { ...n, resolved: true, read: true } : n))
    );
  };

  // (opcional) cerrar UI notif sin deshacer
  const dismissUiNotif = (uiNotif) => {
    setUiNotifs((prev) =>
      prev.map((n) => (n.id === uiNotif.id ? { ...n, resolved: true, read: true } : n))
    );
  };

  return (
    <>
      <IconButton onClick={() => setOpen(true)} color="inherit" aria-label="Abrir notificaciones">
        <Badge badgeContent={badgeCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <div style={{ width: 520, padding: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <Typography variant="h6">Notificaciones</Typography>

            {/* ✅ Botón cerrar arriba a la derecha */}
            <IconButton
              onClick={() => setOpen(false)}
              size="small"
              aria-label="Cerrar panel"
            >
              <CloseIcon />
            </IconButton>
          </div>

          {/* ✅ Botones "Marcar como leídas" debajo del título */}
          {(unreadUiCount > 0 || unreadCount > 0) && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {unreadUiCount > 0 && (
                <Button
                  size="small"
                  startIcon={<CheckIcon />}
                  onClick={markAllUiAsRead}
                  variant="outlined"
                >
                  Marcar como leídas ({unreadUiCount})
                </Button>
              )}

            </Box>
          )}
          <Divider />

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.75 }}>Cargando…</Typography>
            </Box>
          ) : merged.length === 0 ? (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: '32px', textAlign: 'center' }}>
              No hay notificaciones
            </Typography>
          ) : (
            <List>
              {merged.map((notif) => {
                const isUi = notif?.source === 'ui';

                // ✅ UI notif
                if (isUi) {
                  // Función auxiliar para determinar si se puede deshacer
                  const canUndo = (notif) => {
                    if (!notif || notif.source !== 'ui') return false;
                    const kind = notif.kind;
                    const scope = notif.scope || notif.payload?.scope || 'articulo';

                    // Solo discontinuar es reversible
                    return kind === 'discontinue' && (scope === 'articulo' || scope === 'insumo');
                  };

                  // ✅ IMPORTANTE: return explícito del JSX
                  return (
                    <ListItem key={notif.id} disablePadding sx={{ mb: 1.25 }}>
                      <ListItemButton
                        onClick={() =>
                          setUiNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)))
                        }
                        sx={{
                          borderRadius: 2,
                          alignItems: 'flex-start',
                          backgroundColor: notif.read ? 'transparent' : 'rgba(25, 118, 210, 0.08)',
                          border: '1px solid rgba(25, 118, 210, 0.15)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            backgroundColor: notif.read
                              ? 'rgba(25, 118, 210, 0.04)'
                              : 'rgba(25, 118, 210, 0.12)',
                          },
                        }}
                      >
                        <div style={{ marginRight: 12, fontSize: 22, marginTop: 2 }}>
                          {getIcon(notif)}
                        </div>

                        <Box sx={{ flex: 1 }}>
                          <ListItemText
                            secondaryTypographyProps={{ component: 'div' }}
                            primaryTypographyProps={{ component: 'div' }}
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                  component="span"
                                  variant="subtitle2"
                                  sx={{
                                    fontWeight: notif.read ? 600 : 900,
                                    color: notif.read ? 'text.secondary' : 'text.primary',
                                  }}
                                >
                                  {formatTitle(notif)}
                                </Typography>

                                {/* ✅ Badge para scope si es insumo */}
                                {notif.scope === 'insumo' && (
                                  <Chip
                                    label="Insumo"
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.7rem',
                                      bgcolor: 'info.light',
                                      color: 'info.contrastText',
                                    }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box component="span">
                                {notif.message && (
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{
                                      display: 'block',
                                      whiteSpace: 'pre-line',
                                      mt: 0.5,
                                      color: 'text.secondary',
                                    }}
                                  >
                                    {notif.message}
                                  </Typography>
                                )}

                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    mt: 0.75,
                                    opacity: 0.8,
                                    color: 'text.disabled',
                                  }}
                                >
                                  {formatDate(notif.created_at)}
                                </Typography>

                                {/* ✅ Botón Deshacer SOLO para discontinue */}
                                {canUndo(notif) && (
                                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      startIcon={<UndoIcon />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        undoUiNotif(notif);
                                      }}
                                      sx={{ textTransform: 'none' }}
                                    >
                                      Deshacer
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            }
                          />
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  );
                }

                // ✅ Backend notif (código existente sin cambios)
                const busy = rowBusy[notif.id] || '';
                const csId = pickChangeSetId(notif);
                const hasCS = !!csId;

                const scope = notif?.metadata?.scope || notif?.metadata?.scope_name || '';
                const isSyncInsumos = scope === 'insumos' && hasCS;

                const resolutionStatus = notif?.metadata?.resolution?.status || null;
                const isResolved = !!resolutionStatus;

                const showActions = isSyncInsumos && !isResolved;
                const buttonsDisabled = !businessId || !hasCS || !!busy || isResolved;

                return (
                  <ListItem key={notif.id} disablePadding sx={{ mb: 1.25 }}>
                    <ListItemButton
                      onClick={() => onNotifClick(notif)}
                      sx={{
                        borderRadius: 2,
                        alignItems: 'flex-start',
                        backgroundColor: notif.read ? 'transparent' : 'rgba(25, 118, 210, 0.08)',
                        opacity: notif.read ? 0.8 : 1,
                        border: hasCS ? '1px solid rgba(25, 118, 210, 0.15)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ marginRight: 12, fontSize: 22, marginTop: 2 }}>
                        {getIcon(notif)}
                      </div>

                      <Box sx={{ flex: 1 }}>
                        <ListItemText
                          secondaryTypographyProps={{ component: 'div' }}
                          primaryTypographyProps={{ component: 'div' }}
                          primary={(
                            <Typography component="span" variant="subtitle2" sx={{ fontWeight: notif.read ? 600 : 900 }}>
                              {notif.title}
                              {isSyncInsumos && !isResolved && (
                                <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.85 }}>
                                  • cambios detectados
                                </span>
                              )}
                            </Typography>
                          )}
                          secondary={(
                            <Box component="span">
                              {notif.message && (
                                <Typography component="span" variant="body2" sx={{ display: 'block', whiteSpace: 'pre-line', mt: 0.5 }}>
                                  {notif.message}
                                </Typography>
                              )}

                              <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.75, opacity: 0.8 }}>
                                {formatDate(notif.created_at)}
                              </Typography>

                              {isResolved && (
                                <Alert
                                  severity={resolutionStatus === 'applied' ? 'success' : 'warning'}
                                  sx={{ mt: 1, py: 0.5 }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {resolutionStatus === 'applied' && '✅ Cambios aplicados correctamente'}
                                    {resolutionStatus === 'rejected' && '❌ Cambios rechazados - Realizar agrupación manual'}
                                    {resolutionStatus === 'approved' && '✓ Aprobado'}
                                  </Typography>
                                </Alert>
                              )}
                            </Box>
                          )}
                        />

                        {showActions && (
                          <Box
                            sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Acciones backend comentadas */}
                          </Box>
                        )}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                );
              })}
              {uiNotifs.length > 0 && notifications.length > 0 && (
                <Divider sx={{ my: 2 }}>
                  <Chip label="Sistema" size="small" />
                </Divider>
              )}
            </List>
          )}
        </div>
      </Drawer>
    </>
  );
}
