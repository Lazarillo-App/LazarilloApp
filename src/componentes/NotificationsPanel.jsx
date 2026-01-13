// componentes/NotificationsPanel.jsx
import React, { useState } from 'react';
import { Badge, IconButton, Drawer, List, ListItem, ListItemText, Typography, Button, Divider } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationsPanel({ businessId }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({ businessId });

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      markAsRead([notif.id]);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'auto_assign': return '🎯';
      case 'sync_articles': return '🔄';
      case 'sync_sales': return '💰';
      case 'error': return '⚠️';
      default: return '📌';
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} hs`;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <IconButton onClick={() => setOpen(true)} color="inherit">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <div style={{ width: 400, padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Typography variant="h6">Notificaciones</Typography>
            {unreadCount > 0 && (
              <Button size="small" startIcon={<CheckIcon />} onClick={markAllAsRead}>
                Marcar todas
              </Button>
            )}
          </div>

          <Divider />

          {notifications.length === 0 ? (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: '32px', textAlign: 'center' }}>
              No hay notificaciones
            </Typography>
          ) : (
            <List>
              {notifications.map((notif) => (
                <ListItem
                  key={notif.id}
                  button
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    backgroundColor: notif.read ? 'transparent' : 'rgba(25, 118, 210, 0.08)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    opacity: notif.read ? 0.7 : 1
                  }}
                >
                  <div style={{ marginRight: '12px', fontSize: '24px' }}>
                    {getIcon(notif.type)}
                  </div>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" style={{ fontWeight: notif.read ? 400 : 600 }}>
                        {notif.title}
                      </Typography>
                    }
                    secondary={
                      <>
                        {notif.message && (
                          <Typography variant="body2" style={{ whiteSpace: 'pre-line', marginTop: '4px' }}>
                            {notif.message}
                          </Typography>
                        )}
                        <Typography variant="caption" color="textSecondary" style={{ display: 'block', marginTop: '4px' }}>
                          {formatDate(notif.created_at)}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </div>
      </Drawer>
    </>
  );
}