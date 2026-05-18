// hooks/usePersistUiActions.js
import { useEffect } from 'react';
import { http } from '@/servicios/apiBusinesses';

export function usePersistUiActions(businessId) {
  useEffect(() => {
    if (!businessId) return;

    const handleUiAction = async (e) => {
      const detail = e?.detail;
      if (!detail) return;

      // Todos los kinds que se persisten en el panel de notificaciones
      const persistableKinds = new Set([
        // Agrupaciones
        'group_create',
        'group_rename',
        'group_delete',
        'group_move_division',
        'group_favorite_set',
        'group_favorite_unset',
        // Artículos / Insumos — acciones
        'articulo_create', 'articulo_delete', 'articulo_move',
        'insumo_create',   'insumo_delete',   'insumo_move',
        'insumo_group_create', 'insumo_group_rename', 'insumo_group_delete',
        'discontinue',
        // Kinds genéricos que usan algunos componentes
        'move', 'info',
        // Precios / objetivos
        'objetivo_change', 'objetivo_update', 'precio_manual_bulk',
        // Config
        'config_change',
      ]);

      if (!persistableKinds.has(detail.kind)) return;

      try {
        await http(`/businesses/${businessId}/notifications`, {
          method: 'POST',
          body: {
            kind:     detail.kind,
            title:    detail.title,
            message:  detail.message,
            metadata: detail.payload,
            scope:    detail.scope,
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