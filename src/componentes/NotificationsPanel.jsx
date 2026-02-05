/* eslint-disable no-empty */
// componentes/NotificationsPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
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
} from '@mui/material';

import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';

import { useNotifications } from '../hooks/useNotifications';
import { http } from '../servicios/apiBusinesses';

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
  const raw =
    notif?.metadata?.change_set_id ??
    notif?.meta?.change_set_id ??
    null;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function NotificationsPanel({ businessId }) {
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

  const [rowBusy, setRowBusy] = useState({}); // { [notifId]: 'reject'|'apply' }

  const setBusy = useCallback((notifId, actionOrNull) => {
    setRowBusy((prev) => {
      const next = { ...prev };
      if (!actionOrNull) delete next[notifId];
      else next[notifId] = actionOrNull;
      return next;
    });
  }, []);

  // ✅ Al abrir panel, traer listado y count
  useEffect(() => {
    if (!open) return;
    refreshAll?.();
  }, [open, refreshAll]);

  // ✅ Auto-refresh del listado mientras el drawer está abierto
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      refresh?.();
      refreshCount?.();
    }, 15000);
    return () => clearInterval(t);
  }, [open, refresh, refreshCount]);

  // ✅ Iconos según tipo de notificación
  const getIcon = (notif) => {
    const t = notif?.type;
    const scope = notif?.metadata?.scope;

    if (t === 'sync_articles' && scope === 'insumos') return '🔔';
    if (t === 'auto_assign') return '🧠';
    if (t === 'error') return '⚠️';
    return '📌';
  };

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

  const safeRefreshAfterAction = useCallback(async () => {
    await refreshCount?.();
    await refresh?.();
    try { window.dispatchEvent(new CustomEvent('sync:completed')); } catch { }
  }, [refresh, refreshCount]);

  const onNotifClick = useCallback(async (notif) => {
    // ✅ Solo marcar como leída si no está resuelta y no está leída
    if (!notif?.read && !notif?.metadata?.resolution?.status) {
      try {
        await markAsRead([notif.id]);
      } catch (error) {
        console.error('[NotificationsPanel] Error marking as read:', error);
      }
    }
  }, [markAsRead]);

  const rejectInline = useCallback(async (notif) => {
    const csId = pickChangeSetId(notif);
    if (!businessId || !csId) return;

    setBusy(notif.id, 'reject');

    // ✅ Patch optimista ANTES de la llamada
    patchNotification?.(notif.id, {
      read: true,
      metadata: {
        resolution: {
          status: 'rejected',
          at: new Date().toISOString(),
          change_set_id: String(csId)
        },
      },
    });

    try {
      await apiRejectChangeSet(businessId, csId);
      // ✅ El backend ya resolvió la notificación, solo refrescamos
      await safeRefreshAfterAction();
    } catch (e) {
      console.error('[NotificationsPanel] rejectInline error', e);
      // ✅ Rollback del patch optimista
      patchNotification?.(notif.id, {
        read: false,
        metadata: {
          resolution: null,
        },
      });
      await safeRefreshAfterAction();
    } finally {
      setBusy(notif.id, null);
    }
  }, [businessId, setBusy, patchNotification, safeRefreshAfterAction]);

  const acceptAndApplyInline = useCallback(async (notif) => {
    const csId = pickChangeSetId(notif);
    if (!businessId || !csId) return;

    setBusy(notif.id, 'apply');

    // ✅ Patch optimista ANTES de la llamada
    patchNotification?.(notif.id, {
      read: true,
      metadata: {
        resolution: {
          status: 'applied',
          at: new Date().toISOString(),
          change_set_id: String(csId)
        },
      },
    });

    try {
      const cs = await apiGetChangeSet(businessId, csId);
      const status = String(cs?.item?.status || '');

      // ✅ Si ya fue aplicado o rechazado, solo refrescamos
      if (status === 'applied' || status === 'rejected') {
        await safeRefreshAfterAction();
        return;
      }

      // ✅ Si está pendiente o en error, primero aprobar
      if (status === 'pending' || status === 'error') {
        await apiApproveChangeSet(businessId, csId);
      }

      // ✅ Aplicar cambios
      await apiApplyChangeSet(businessId, csId);

      // ✅ El backend ya resolvió la notificación, solo refrescamos
      await safeRefreshAfterAction();
    } catch (e) {
      console.error('[NotificationsPanel] acceptAndApplyInline error', e);
      // ✅ Rollback del patch optimista
      patchNotification?.(notif.id, {
        read: false,
        metadata: {
          resolution: null,
        },
      });
      await safeRefreshAfterAction();
    } finally {
      setBusy(notif.id, null);
    }
  }, [businessId, setBusy, patchNotification, safeRefreshAfterAction]);

  return (
    <>
      <IconButton onClick={() => setOpen(true)} color="inherit" aria-label="Abrir notificaciones">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <div style={{ width: 520, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Typography variant="h6">Notificaciones</Typography>
            {unreadCount > 0 && (
              <Button size="small" startIcon={<CheckIcon />} onClick={markAllAsRead}>
                Marcar todas
              </Button>
            )}
          </div>

          <Divider />

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ mt: 1, opacity: 0.75 }}>
                Cargando…
              </Typography>
            </Box>
          ) : notifications.length === 0 ? (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: '32px', textAlign: 'center' }}>
              No hay notificaciones
            </Typography>
          ) : (
            <List>
              {notifications
                .filter((n) => !businessId || Number(n.business_id) === Number(businessId))
                .map((notif) => {
                  const busy = rowBusy[notif.id] || '';

                  const csId = pickChangeSetId(notif);
                  const hasCS = !!csId;

                  const scope = notif?.metadata?.scope || notif?.metadata?.scope_name || '';
                  const isSyncInsumos = scope === 'insumos' && hasCS;

                  const resolutionStatus = notif?.metadata?.resolution?.status || null;
                  const isResolved = !!resolutionStatus;

                  // ✅ Los botones SOLO aparecen si es sync de insumos Y no está resuelta
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
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{ display: 'block', whiteSpace: 'pre-line', mt: 0.5 }}
                                  >
                                    {notif.message}
                                  </Typography>
                                )}

                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ display: 'block', mt: 0.75, opacity: 0.8 }}
                                >
                                  {formatDate(notif.created_at)}
                                </Typography>

                                {/* ✅ NUEVO: Mensaje claro según el estado de resolución */}
                                {isResolved && (
                                  <Alert 
                                    severity={resolutionStatus === 'applied' ? 'success' : 'warning'}
                                    sx={{ mt: 1, py: 0.5 }}
                                  >
                                    {resolutionStatus === 'applied' && (
                                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        ✅ Cambios aplicados correctamente
                                      </Typography>
                                    )}
                                    {resolutionStatus === 'rejected' && (
                                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        ❌ Cambios rechazados - Realizar agrupación de manera manual
                                      </Typography>
                                    )}
                                    {resolutionStatus === 'approved' && (
                                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                        ✓ Aprobado
                                      </Typography>
                                    )}
                                  </Alert>
                                )}
                              </Box>
                            )}
                          />

                          {/* ✅ Los botones solo se muestran si showActions es true */}
                          {showActions && (
                            <Box
                              sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={busy === 'apply' ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
                                disabled={buttonsDisabled}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  acceptAndApplyInline(notif);
                                }}
                              >
                                {busy === 'apply' ? 'Aplicando…' : 'Aceptar y aplicar'}
                              </Button>

                              <Button
                                size="small"
                                color="error"
                                startIcon={busy === 'reject' ? <CircularProgress size={14} color="inherit" /> : <ThumbDownAltIcon />}
                                disabled={buttonsDisabled}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rejectInline(notif);
                                }}
                              >
                                {busy === 'reject' ? 'Rechazando…' : 'Rechazar'}
                              </Button>
                            </Box>
                          )}
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  );
                })}
            </List>
          )}
        </div>
      </Drawer>
    </>
  );
}