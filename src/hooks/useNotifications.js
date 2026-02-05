// hooks/useNotifications.js
import { useState, useEffect, useCallback, useRef } from 'react';
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

  // ✅ NUEVO: Clave para localStorage basada en businessId
  const getOptimisticKey = useCallback(() => {
    return `optimisticPatches:${businessId || 'global'}`;
  }, [businessId]);

  // ✅ NUEVO: Cargar patches desde localStorage al iniciar
  const loadOptimisticPatches = useCallback(() => {
    try {
      const key = getOptimisticKey();
      const stored = localStorage.getItem(key);
      if (!stored) return {};
      
      const parsed = JSON.parse(stored);
      
      // Limpiar patches viejos (más de 24 horas)
      const now = Date.now();
      const cleaned = {};
      Object.entries(parsed).forEach(([notifId, patch]) => {
        const age = now - (patch._timestamp || 0);
        if (age < 24 * 60 * 60 * 1000) { // 24 horas
          cleaned[notifId] = patch;
        }
      });
      
      // Si limpiamos algo, guardar la versión limpia
      if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
      
      return cleaned;
    } catch (error) {
      console.error('[useNotifications] Error loading patches:', error);
      return {};
    }
  }, [getOptimisticKey]);

  // ✅ NUEVO: Guardar patches en localStorage
  const saveOptimisticPatches = useCallback((patches) => {
    try {
      const key = getOptimisticKey();
      if (Object.keys(patches).length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(patches));
      }
    } catch (error) {
      console.error('[useNotifications] Error saving patches:', error);
    }
  }, [getOptimisticKey]);

  // ✅ Inicializar con patches de localStorage
  const optimisticPatches = useRef(loadOptimisticPatches());

  const applyOptimisticPatches = useCallback((notifs) => {
    if (!Array.isArray(notifs) || notifs.length === 0) return notifs;

    return notifs.map((n) => {
      const patch = optimisticPatches.current[String(n.id)];
      if (!patch) return n;

      // ✅ Si el backend ya tiene la resolución, eliminar el patch
      if (n.metadata?.resolution?.status === patch.metadata?.resolution?.status) {
        delete optimisticPatches.current[String(n.id)];
        saveOptimisticPatches(optimisticPatches.current);
        return n;
      }

      const nextMeta = patch?.metadata
        ? {
            ...(n.metadata || {}),
            ...(patch.metadata || {}),
          }
        : (n.metadata || {});

      if (patch?.metadata && Object.prototype.hasOwnProperty.call(patch.metadata, 'resolution')) {
        nextMeta.resolution = patch.metadata.resolution;
      }

      return {
        ...n,
        ...patch,
        metadata: nextMeta,
      };
    });
  }, [saveOptimisticPatches]);

  const fetchNotifications = useCallback(async () => {
    if (!businessId) return;
    if (mode === 'count') return;

    try {
      setLoading(true);
      const data = await http(`/businesses/${businessId}/notifications?limit=50`);
      const rawNotifs = Array.isArray(data?.notifications) ? data.notifications : [];
      
      // ✅ Aplicar patches optimistas sobre los datos frescos del backend
      const patchedNotifs = applyOptimisticPatches(rawNotifs);
      setNotifications(patchedNotifs);
    } catch (error) {
      console.error('[useNotifications] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId, mode, applyOptimisticPatches]);

  const fetchUnreadCount = useCallback(async () => {
    if (!businessId) return;

    try {
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

  // ✅ MEJORADO: patch optimista persistente en localStorage
  const patchNotification = useCallback((notifId, patch) => {
    if (!notifId) return;

    const key = String(notifId);

    // Guardar el patch en la referencia persistente
    if (patch === null || (patch?.metadata?.resolution === null && Object.keys(patch).length === 1)) {
      // Si es un rollback, eliminar el patch
      delete optimisticPatches.current[key];
    } else {
      // Guardar el patch con timestamp
      optimisticPatches.current[key] = {
        ...patch,
        _timestamp: Date.now(),
      };
    }

    // ✅ Persistir en localStorage
    saveOptimisticPatches(optimisticPatches.current);

    // Aplicar inmediatamente al estado actual
    setNotifications((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      return prev.map((n) => {
        if (String(n.id) !== key) return n;

        if (patch === null) return n; // rollback

        const nextMeta = patch?.metadata
          ? {
              ...(n.metadata || {}),
              ...(patch.metadata || {}),
            }
          : (n.metadata || {});

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
  }, [saveOptimisticPatches]);

  const markAsRead = useCallback(
    async (notificationIds) => {
      if (!businessId) return;
      if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;

      // ✅ optimistic
      notificationIds.forEach((id) => patchNotification(id, { read: true }));

      try {
        await http(`/businesses/${businessId}/notifications/mark-read`, {
          method: 'POST',
          body: { notification_ids: notificationIds },
        });
        await fetchUnreadCount();
      } catch (error) {
        console.error('[useNotifications] Error marking read:', error);
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