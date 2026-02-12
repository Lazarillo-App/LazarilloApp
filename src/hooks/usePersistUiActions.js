// hooks/usePersistUiActions.js
import { useEffect } from 'react';
import { http } from '@/servicios/apiBusinesses';

export function usePersistUiActions(businessId) {
  useEffect(() => {
    if (!businessId) return;

    const handleUiAction = async (e) => {
      const detail = e?.detail;
      if (!detail) return;

      // Solo persistir ciertos tipos
      const persistableKinds = new Set([
        'group_create',
        'group_rename',
        'group_delete',
        'group_move_division',
        'discontinue',
      ]);

      if (!persistableKinds.has(detail.kind)) return;

      try {
        await http(`/businesses/${businessId}/notifications`, {
          method: 'POST',
          body: {
            kind: detail.kind,
            title: detail.title,
            message: detail.message,
            metadata: detail.payload,
            scope: detail.scope,
          },
        });
      } catch (err) {
        console.warn('[usePersistUiActions] Error persistiendo:', err);
      }
    };

    window.addEventListener('ui:action', handleUiAction);
    return () => window.removeEventListener('ui:action', handleUiAction);
  }, [businessId]);
}