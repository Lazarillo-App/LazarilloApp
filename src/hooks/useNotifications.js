// hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { http } from '../servicios/apiBusinesses';

export function useNotifications({ businessId, autoRefresh = true, refreshInterval = 30000 }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!businessId) return;
    
    try {
      setLoading(true);
      const data = await http(`/notifications?business_id=${businessId}&limit=50`);
      setNotifications(data?.notifications || []);
    } catch (error) {
      console.error('[useNotifications] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const fetchUnreadCount = useCallback(async () => {
    if (!businessId) return;
    
    try {
      const data = await http(`/notifications/unread-count?business_id=${businessId}`);
      setUnreadCount(data?.count || 0);
    } catch (error) {
      console.error('[useNotifications] Error counting:', error);
    }
  }, [businessId]);

  const markAsRead = useCallback(async (notificationIds) => {
    try {
      await http('/notifications/mark-read', {
        method: 'POST',
        body: { notification_ids: notificationIds }
      });
      
      // Actualizar local
      setNotifications(prev => 
        prev.map(n => 
          notificationIds.includes(n.id) ? { ...n, read: true } : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('[useNotifications] Error marking read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await http('/notifications/mark-all-read', {
        method: 'POST',
        body: { business_id: businessId }
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[useNotifications] Error marking all read:', error);
    }
  }, [businessId]);

  // Fetch inicial
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchUnreadCount]);

  // Escuchar evento de sync completado
  useEffect(() => {
    const handleSync = () => {
      fetchNotifications();
      fetchUnreadCount();
    };

    window.addEventListener('sync:completed', handleSync);
    return () => window.removeEventListener('sync:completed', handleSync);
  }, [fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}