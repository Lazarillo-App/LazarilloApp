// src/utils/groupMutations.js

/**
 * 🔄 MUTACIONES OPTIMISTAS PARA AGRUPACIONES
 * 
 * Este módulo contiene funciones puras para aplicar mutaciones optimistas
 * a la lista de agrupaciones (artículos o insumos) ANTES de que el backend
 * responda, mejorando la experiencia de usuario.
 * 
 * VENTAJAS:
 * - UI responde instantáneamente
 * - Backend consolida cambios después
 * - Rollback automático si falla
 * 
 * IMPORTANTE:
 * - Todas las funciones son PURAS (sin side effects)
 * - Retornan una NUEVA copia del array (immutabilidad)
 * - Funcionan tanto para artículos como para insumos
 */

/* ============================================================================
   HELPERS PRIVADOS
============================================================================ */

/**
 * Clona profundamente un objeto/array
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
  );
};

/**
 * Obtiene el array de items de una agrupación (artículos o insumos)
 */
const getItems = (group) => {
  if (!group) return [];
  return (
    group.articulos ||
    group.insumos ||
    group.items ||
    []
  );
};

/**
 * Setea el array de items de una agrupación
 */
const setItems = (group, items) => {
  const key = group.articulos ? 'articulos' :
              group.insumos ? 'insumos' :
              'items';
  return { ...group, [key]: items };
};

/**
 * Obtiene el ID de un item (artículo o insumo)
 */
const getItemId = (item) => {
  const raw =
    item?.id ??
    item?.article_id ??
    item?.articulo_id ??
    item?.insumo_id ??
    item?.insumoId ??
    item?.articuloId;
  
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Enriquece un item con datos del catálogo (baseById)
 */
const enrichItem = (item, baseById) => {
  if (!baseById) return item;
  
  const id = getItemId(item);
  if (id == null) return item;
  
  const base = baseById.get(id);
  if (!base) return item;
  
  // Merge: prioridad a item (puede tener datos más actualizados)
  return {
    ...base,
    ...item,
    id,
  };
};

/* ============================================================================
   MUTACIONES PÚBLICAS
============================================================================ */

/**
 * CREATE - Crear nueva agrupación
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} newGroup - Nueva agrupación a crear
 * @param {number} newGroup.id - ID de la nueva agrupación
 * @param {string} newGroup.nombre - Nombre de la agrupación
 * @param {Array} newGroup.articulos|insumos - Items iniciales
 * @returns {Array} Nueva copia del array con la agrupación agregada
 * 
 * @example
 * const updated = applyCreateGroup(groups, {
 *   id: 42,
 *   nombre: "Promociones",
 *   articulos: [{ id: 123, nombre: "Combo 1" }],
 * });
 */
export function applyCreateGroup(groups, newGroup) {
  if (!newGroup || !Number.isFinite(Number(newGroup.id))) {
    console.warn('[groupMutations] applyCreateGroup: newGroup inválido', newGroup);
    return groups;
  }
  
  // Evitar duplicados
  const exists = groups.find(g => Number(g.id) === Number(newGroup.id));
  if (exists) {
    console.warn('[groupMutations] applyCreateGroup: grupo ya existe', newGroup.id);
    return groups;
  }
  
  return [...groups, deepClone(newGroup)];
}

/**
 * APPEND - Agregar items a una agrupación existente
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} params - Parámetros de la mutación
 * @param {number} params.groupId - ID de la agrupación destino
 * @param {Array} params.articulos|insumos - Items a agregar
 * @param {Map} params.baseById - Catálogo completo (opcional, para enriquecer)
 * @returns {Array} Nueva copia del array con items agregados
 * 
 * @example
 * const updated = applyAppend(groups, {
 *   groupId: 5,
 *   articulos: [{ id: 123 }, { id: 456 }],
 *   baseById: articulosMap, // opcional
 * });
 */
export function applyAppend(groups, { groupId, articulos, insumos, baseById }) {
  const gid = Number(groupId);
  if (!Number.isFinite(gid) || gid <= 0) {
    console.warn('[groupMutations] applyAppend: groupId inválido', groupId);
    return groups;
  }
  
  const newItems = articulos || insumos || [];
  if (!Array.isArray(newItems) || !newItems.length) {
    console.warn('[groupMutations] applyAppend: sin items', { groupId, articulos, insumos });
    return groups;
  }
  
  return groups.map(g => {
    if (Number(g.id) !== gid) return g;
    
    const current = getItems(g);
    const currentIds = new Set(current.map(getItemId).filter(Boolean));
    
    // Solo agregar los que no estén ya
    const toAdd = newItems
      .filter(item => {
        const id = getItemId(item);
        return id != null && !currentIds.has(id);
      })
      .map(item => enrichItem(item, baseById));
    
    if (!toAdd.length) return g;
    
    return setItems(g, [...current, ...toAdd]);
  });
}

/**
 * REMOVE - Quitar items de una agrupación
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} params - Parámetros de la mutación
 * @param {number} params.groupId - ID de la agrupación
 * @param {Array<number>} params.ids - IDs de items a quitar
 * @returns {Array} Nueva copia del array con items quitados
 * 
 * @example
 * const updated = applyRemove(groups, {
 *   groupId: 5,
 *   ids: [123, 456, 789],
 * });
 */
export function applyRemove(groups, { groupId, ids }) {
  const gid = Number(groupId);
  if (!Number.isFinite(gid) || gid <= 0) {
    console.warn('[groupMutations] applyRemove: groupId inválido', groupId);
    return groups;
  }
  
  if (!Array.isArray(ids) || !ids.length) {
    console.warn('[groupMutations] applyRemove: ids inválido', ids);
    return groups;
  }
  
  const idsSet = new Set(ids.map(Number).filter(Number.isFinite));
  
  return groups.map(g => {
    if (Number(g.id) !== gid) return g;
    
    const current = getItems(g);
    const filtered = current.filter(item => {
      const id = getItemId(item);
      return id == null || !idsSet.has(id);
    });
    
    return setItems(g, filtered);
  });
}

/**
 * MOVE - Mover items entre agrupaciones
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} params - Parámetros de la mutación
 * @param {number} params.fromId - ID de agrupación origen
 * @param {number} params.toId - ID de agrupación destino
 * @param {Array<number>} params.ids - IDs de items a mover
 * @param {Map} params.baseById - Catálogo completo (opcional)
 * @returns {Array} Nueva copia del array con items movidos
 * 
 * @example
 * const updated = applyMove(groups, {
 *   fromId: 5,
 *   toId: 8,
 *   ids: [123, 456],
 *   baseById: articulosMap, // opcional
 * });
 */
export function applyMove(groups, { fromId, toId, ids, baseById }) {
  const fid = Number(fromId);
  const tid = Number(toId);
  
  if (!Number.isFinite(fid) || fid <= 0) {
    console.warn('[groupMutations] applyMove: fromId inválido', fromId);
    return groups;
  }
  
  if (!Number.isFinite(tid) || tid <= 0) {
    console.warn('[groupMutations] applyMove: toId inválido', toId);
    return groups;
  }
  
  if (fid === tid) {
    console.warn('[groupMutations] applyMove: fromId === toId', fid);
    return groups;
  }
  
  if (!Array.isArray(ids) || !ids.length) {
    console.warn('[groupMutations] applyMove: ids inválido', ids);
    return groups;
  }
  
  const idsSet = new Set(ids.map(Number).filter(Number.isFinite));
  
  // 1. Extraer items del grupo origen
  let itemsToMove = [];
  
  const afterRemove = groups.map(g => {
    if (Number(g.id) !== fid) return g;
    
    const current = getItems(g);
    const kept = [];
    
    for (const item of current) {
      const id = getItemId(item);
      if (id != null && idsSet.has(id)) {
        itemsToMove.push(enrichItem(item, baseById));
      } else {
        kept.push(item);
      }
    }
    
    return setItems(g, kept);
  });
  
  if (!itemsToMove.length) {
    console.warn('[groupMutations] applyMove: no se encontraron items en origen', { fromId, ids });
    return groups;
  }
  
  // 2. Agregar al grupo destino
  return afterRemove.map(g => {
    if (Number(g.id) !== tid) return g;
    
    const current = getItems(g);
    const currentIds = new Set(current.map(getItemId).filter(Boolean));
    
    // Solo agregar los que no estén ya
    const toAdd = itemsToMove.filter(item => {
      const id = getItemId(item);
      return id != null && !currentIds.has(id);
    });
    
    if (!toAdd.length) return g;
    
    return setItems(g, [...current, ...toAdd]);
  });
}

/**
 * RENAME - Renombrar una agrupación
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} params - Parámetros de la mutación
 * @param {number} params.groupId - ID de la agrupación
 * @param {string} params.nombre - Nuevo nombre
 * @returns {Array} Nueva copia del array con nombre actualizado
 * 
 * @example
 * const updated = applyRename(groups, {
 *   groupId: 5,
 *   nombre: "Bebidas Premium",
 * });
 */
export function applyRename(groups, { groupId, nombre }) {
  const gid = Number(groupId);
  if (!Number.isFinite(gid) || gid <= 0) {
    console.warn('[groupMutations] applyRename: groupId inválido', groupId);
    return groups;
  }
  
  const trimmed = String(nombre || '').trim();
  if (!trimmed) {
    console.warn('[groupMutations] applyRename: nombre vacío', nombre);
    return groups;
  }
  
  return groups.map(g => {
    if (Number(g.id) !== gid) return g;
    return { ...g, nombre: trimmed };
  });
}

/**
 * DELETE - Eliminar una agrupación completa
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} params - Parámetros de la mutación
 * @param {number} params.groupId - ID de la agrupación a eliminar
 * @returns {Array} Nueva copia del array sin la agrupación
 * 
 * @example
 * const updated = applyDelete(groups, { groupId: 5 });
 */
export function applyDelete(groups, { groupId }) {
  const gid = Number(groupId);
  if (!Number.isFinite(gid) || gid <= 0) {
    console.warn('[groupMutations] applyDelete: groupId inválido', groupId);
    return groups;
  }
  
  return groups.filter(g => Number(g.id) !== gid);
}

/**
 * SET_FAVORITE - Marcar/desmarcar favorita
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} params - Parámetros de la mutación
 * @param {number} params.groupId - ID de la agrupación
 * @param {boolean} params.isFavorite - true = marcar, false = desmarcar
 * @returns {Array} Nueva copia del array con favorita actualizada
 * 
 * @example
 * const updated = applySetFavorite(groups, {
 *   groupId: 5,
 *   isFavorite: true,
 * });
 */
export function applySetFavorite(groups, { groupId, isFavorite }) {
  const gid = Number(groupId);
  if (!Number.isFinite(gid) || gid <= 0) {
    console.warn('[groupMutations] applySetFavorite: groupId inválido', groupId);
    return groups;
  }
  
  return groups.map(g => {
    // Si es la que queremos marcar, la marcamos
    if (Number(g.id) === gid) {
      return { ...g, es_favorita: !!isFavorite };
    }
    // Si queremos marcar una nueva, desmarcamos todas las demás
    if (isFavorite) {
      return { ...g, es_favorita: false };
    }
    // Si solo desmarcamos, no tocamos las demás
    return g;
  });
}

/* ============================================================================
   HANDLER GENÉRICO (simplifica uso en componentes)
============================================================================ */

/**
 * Aplica una mutación según el tipo
 * 
 * @param {Array} groups - Array de agrupaciones actual
 * @param {Object} action - Acción a aplicar
 * @param {string} action.type - Tipo de mutación
 * @returns {Array} Nueva copia del array con la mutación aplicada
 * 
 * @example
 * const updated = applyMutation(groups, {
 *   type: 'create',
 *   id: 42,
 *   nombre: "Promociones",
 *   articulos: [...],
 * });
 */
export function applyMutation(groups, action) {
  if (!action || !action.type) {
    console.warn('[groupMutations] applyMutation: action sin type', action);
    return groups;
  }
  
  switch (action.type) {
    case 'create':
      return applyCreateGroup(groups, {
        id: action.id,
        nombre: action.nombre,
        articulos: action.articulos,
        insumos: action.insumos,
      });
      
    case 'append':
      return applyAppend(groups, {
        groupId: action.groupId,
        articulos: action.articulos,
        insumos: action.insumos,
        baseById: action.baseById,
      });
      
    case 'remove':
      return applyRemove(groups, {
        groupId: action.groupId,
        ids: action.ids,
      });
      
    case 'move':
      return applyMove(groups, {
        fromId: action.fromId,
        toId: action.toId,
        ids: action.ids,
        baseById: action.baseById,
      });
      
    case 'rename':
      return applyRename(groups, {
        groupId: action.groupId,
        nombre: action.nombre,
      });
      
    case 'delete':
      return applyDelete(groups, {
        groupId: action.groupId,
      });
      
    case 'setFavorite':
      return applySetFavorite(groups, {
        groupId: action.groupId,
        isFavorite: action.isFavorite,
      });
      
    default:
      console.warn('[groupMutations] applyMutation: tipo desconocido', action.type);
      return groups;
  }
}

/* ============================================================================
   EXPORTS
============================================================================ */

export default {
  applyCreateGroup,
  applyAppend,
  applyRemove,
  applyMove,
  applyRename,
  applyDelete,
  applySetFavorite,
  applyMutation,
};