// src/servicios/notifyGroupActions.js

/**
 * Helper centralizado para emitir notificaciones UI de acciones de agrupaciones
 * Estas notificaciones persisten en localStorage hasta que el usuario las marque como leídas
 */

/**
 * Emite notificación cuando se edita/renombra una agrupación
 * @param {Object} params
 * @param {number} params.businessId - ID del negocio
 * @param {number} params.groupId - ID de la agrupación
 * @param {string} params.oldName - Nombre anterior
 * @param {string} params.newName - Nombre nuevo
 * @param {string} [params.scope='articulo'] - Scope (articulo/insumo)
 */
export function notifyGroupRenamed({ businessId, groupId, oldName, newName, scope = 'articulo' }) {
  const actionId = `rename_${groupId}_${Date.now()}`;

  window.dispatchEvent(
    new CustomEvent('ui:action', {
      detail: {
        actionId,
        kind: 'group_rename',
        scope,
        businessId,
        title: '✏️ Agrupación renombrada',
        message: `"${oldName}" → "${newName}"`,
        createdAt: new Date().toISOString(),
        payload: {
          groupId,
          oldName,
          newName,
          scope,
        },
      },
    })
  );
}

/**
 * Emite notificación cuando se elimina una agrupación
 * @param {Object} params
 * @param {number} params.businessId - ID del negocio
 * @param {number} params.groupId - ID de la agrupación eliminada
 * @param {string} params.groupName - Nombre de la agrupación
 * @param {number} params.itemCount - Cantidad de items que tenía
 * @param {string} [params.scope='articulo'] - Scope (articulo/insumo)
 */
export function notifyGroupDeleted({ businessId, groupId, groupName, itemCount, scope = 'articulo' }) {
  const actionId = `delete_${groupId}_${Date.now()}`;

  window.dispatchEvent(
    new CustomEvent('ui:action', {
      detail: {
        actionId,
        kind: 'group_delete',
        scope,
        businessId,
        title: '🗑️ Agrupación eliminada',
        message: `"${groupName}" con ${itemCount} ${scope === 'articulo' ? 'artículo' : 'insumo'}${itemCount !== 1 ? 's' : ''}`,
        createdAt: new Date().toISOString(),
        payload: {
          groupId,
          groupName,
          itemCount,
          scope,
        },
      },
    })
  );
}

/**
 * Emite notificación cuando se asigna una agrupación a una división
 * @param {Object} params
 * @param {number} params.businessId - ID del negocio
 * @param {number} params.groupId - ID de la agrupación
 * @param {string} params.groupName - Nombre de la agrupación
 * @param {number|null} params.divisionId - ID de la división destino (null = Principal)
 * @param {string} params.divisionName - Nombre de la división
 * @param {string} [params.scope='articulo'] - Scope (articulo/insumo)
 */
export function notifyGroupMovedToDivision({ businessId, groupId, groupName, divisionId, divisionName, scope = 'articulo' }) {
  const actionId = `move_div_${groupId}_${divisionId}_${Date.now()}`;

  window.dispatchEvent(
    new CustomEvent('ui:action', {
      detail: {
        actionId,
        kind: 'group_move_division',
        scope,
        businessId,
        title: '🔀 Agrupación enviada a división',
        message: `"${groupName}" → ${divisionName}`,
        createdAt: new Date().toISOString(),
        payload: {
          groupId,
          groupName,
          divisionId,
          divisionName,
          scope,
        },
      },
    })
  );
}

/**
 * Emite notificación cuando se marca una agrupación como favorita
 * @param {Object} params
 * @param {number} params.businessId - ID del negocio
 * @param {number} params.groupId - ID de la agrupación
 * @param {string} params.groupName - Nombre de la agrupación
 * @param {boolean} params.isFavorite - true si se marcó, false si se desmarcó
 * @param {number|null} [params.divisionId] - ID de la división (null = Principal)
 * @param {string} [params.scope='articulo'] - Scope (articulo/insumo)
 */
export function notifyGroupFavoriteChanged({ businessId, groupId, groupName, isFavorite, divisionId = null, scope = 'articulo' }) {
  const actionId = `fav_${groupId}_${isFavorite}_${Date.now()}`;
  
  const divText = divisionId ? ` (División)` : '';

  window.dispatchEvent(
    new CustomEvent('ui:action', {
      detail: {
        actionId,
        kind: isFavorite ? 'group_favorite_set' : 'group_favorite_unset',
        scope,
        businessId,
        title: isFavorite ? '⭐ Marcada como favorita' : '☆ Desmarcada como favorita',
        message: `"${groupName}"${divText}`,
        createdAt: new Date().toISOString(),
        payload: {
          groupId,
          groupName,
          isFavorite,
          divisionId,
          scope,
        },
      },
    })
  );
}

/**
 * Emite notificación cuando se crea una nueva agrupación
 * @param {Object} params
 * @param {number} params.businessId - ID del negocio
 * @param {number} params.groupId - ID de la agrupación creada
 * @param {string} params.groupName - Nombre de la agrupación
 * @param {number} params.itemCount - Cantidad de items iniciales
 * @param {string} [params.scope='articulo'] - Scope (articulo/insumo)
 */
export function notifyGroupCreated({ businessId, groupId, groupName, itemCount, scope = 'articulo' }) {
  const actionId = `create_${groupId}_${Date.now()}`;

  window.dispatchEvent(
    new CustomEvent('ui:action', {
      detail: {
        actionId,
        kind: 'group_create',
        scope,
        businessId,
        title: '🆕 Nueva agrupación',
        message: `"${groupName}" con ${itemCount} ${scope === 'articulo' ? 'artículo' : 'insumo'}${itemCount !== 1 ? 's' : ''}`,
        createdAt: new Date().toISOString(),
        payload: {
          groupId,
          groupName,
          itemCount,
          scope,
        },
      },
    })
  );
}