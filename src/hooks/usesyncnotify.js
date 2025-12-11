// src/hooks/useSyncNotify.js
import { useState, useCallback } from 'react';

/**
 * Hook para manejar notificaciones de sincronización
 * 
 * Uso:
 * ```js
 * const { notify, snackbar, closeSnackbar } = useSyncNotify();
 * 
 * notify('Mensaje', 'success'); // 'success' | 'error' | 'warning' | 'info' | 'loading'
 * 
 * // En el JSX:
 * <Snackbar open={snackbar.open} ...>
 *   <Alert severity={snackbar.type}>{snackbar.msg}</Alert>
 * </Snackbar>
 * ```
 */
export function useSyncNotify() {
  const [snackbar, setSnackbar] = useState({
    open: false,
    msg: '',
    type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'loading'
  });

  const notify = useCallback((msg, type = 'info') => {
    setSnackbar({
      open: true,
      msg: String(msg || ''),
      type,
    });
  }, []);

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return {
    notify,
    snackbar,
    closeSnackbar,
  };
}