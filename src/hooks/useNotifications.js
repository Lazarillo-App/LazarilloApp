// hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { http } from '../servicios/apiBusinesses';

/**
 * mode:
 * - 'full': trae listado + count (para panel)
 * - 'count': solo count (para puntito del navbar)
 */
export function useNotifications({
  businessId,
  autoRefresh = true,
  refreshInterval = 30000,
  mode = 'full',
}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!businessId) return;
    if (mode === 'count') return;

    try {
      setLoading(true);
      // ✅ CORREGIDO: usar la ruta correcta con businessId
      const data = await http(`/businesses/${businessId}/notifications?limit=50`);
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (error) {
      console.error('[useNotifications] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId, mode]);

  const fetchUnreadCount = useCallback(async () => {
    if (!businessId) return;

    try {
      // ✅ CORREGIDO: usar la ruta correcta con businessId
      const data = await http(`/businesses/${businessId}/notifications/unread-count`);
      setUnreadCount(Number(data?.count || 0));
    } catch (error) {
      console.error('[useNotifications] Error counting:', error);
    }
  }, [businessId]);

  const refreshAll = useCallback(async () => {
    await fetchUnreadCount();
    await fetchNotifications();
  }, [fetchUnreadCount, fetchNotifications]);

  // ✅ NUEVO: patch local para optimistic UI (no depende del backend)
  const patchNotification = useCallback((notifId, patch) => {
    if (!notifId) return;
    setNotifications((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      return prev.map((n) => {
        if (String(n.id) !== String(notifId)) return n;

        const nextMeta =
          patch?.metadata
            ? {
                ...(n.metadata || {}),
                ...(patch.metadata || {}),
              }
            : (n.metadata || {});

        // OJO: si patch trae metadata: {resolution: null} esto lo deja null
        if (patch?.metadata && Object.prototype.hasOwnProperty.call(patch.metadata, 'resolution')) {
          nextMeta.resolution = patch.metadata.resolution;
        }

        return {
          ...n,
          ...patch,
          metadata: nextMeta,
        };
      });
    });
  }, []);

  const markAsRead = useCallback(
    async (notificationIds) => {
      if (!businessId) return;
      if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;

      // ✅ optimistic
      notificationIds.forEach((id) => patchNotification(id, { read: true }));

      try {
        // ✅ CORREGIDO: usar la ruta correcta con businessId
        await http(`/businesses/${businessId}/notifications/mark-read`, {
          method: 'POST',
          body: { notification_ids: notificationIds },
        });
        await fetchUnreadCount();
      } catch (error) {
        console.error('[useNotifications] Error marking read:', error);
        // rollback opcional: no lo hago para no reactivar el puntito por un fallo chico
      }
    },
    [businessId, fetchUnreadCount, patchNotification]
  );

  const markAllAsRead = useCallback(async () => {
    if (!businessId) return;

    // ✅ optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      // ✅ CORREGIDO: usar la ruta correcta con businessId
      await http(`/businesses/${businessId}/notifications/mark-all-read`, {
        method: 'POST',
        body: { business_id: businessId },
      });
    } catch (error) {
      console.error('[useNotifications] Error marking all read:', error);
      await fetchUnreadCount();
      await fetchNotifications();
    }
  }, [businessId, fetchNotifications, fetchUnreadCount]);

  // Fetch inicial
  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications();
  }, [fetchUnreadCount, fetchNotifications]);

  // Auto-refresh del puntito (y si querés, también del listado cuando el panel lo llame)
  useEffect(() => {
    if (!autoRefresh) return;
    if (!businessId) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchUnreadCount, businessId]);

  // Evento externo: sync completado
  useEffect(() => {
    const handleSync = () => {
      fetchUnreadCount();
      fetchNotifications();
    };

    window.addEventListener('sync:completed', handleSync);
    return () => window.removeEventListener('sync:completed', handleSync);
  }, [fetchUnreadCount, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh: fetchNotifications,
    refreshCount: fetchUnreadCount,
    refreshAll,
    markAsRead,
    markAllAsRead,
    patchNotification, 
  };
}