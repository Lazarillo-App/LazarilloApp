// src/servicios/apiInsumosTodo.js
/**
 * API para gestión de grupo TODO (Sin agrupación) y Discontinuados en Insumos
 */

import { 
  insumoGroupsList,
  insumoGroupCreate,
  insumoGroupGetExclusions,
  insumoGroupAddExclusions,
  insumoGroupRemoveExclusions,
} from './apiInsumos';

/**
 * Asegura que existe un grupo "Sin agrupación" (TODO) para insumos
 */
export async function ensureTodoInsumos() {
  try {
    const res = await insumoGroupsList();
    const groups = Array.isArray(res?.data) ? res.data : [];

    const todoGroup = groups.find(g => {
      const nombre = String(g?.nombre || '').trim().toUpperCase();
      return (
        nombre === 'TODO' ||
        nombre === 'SIN AGRUPACION' ||
        nombre === 'SIN AGRUPACIÓN' ||
        nombre === 'SIN AGRUPAR' ||
        nombre === 'SIN GRUPO'
      );
    });

    if (todoGroup) {
      console.log('[ensureTodoInsumos] Grupo TODO ya existe:', todoGroup.id);
      return todoGroup;
    }

    console.log('[ensureTodoInsumos] Creando grupo TODO...');
    const created = await insumoGroupCreate({
      nombre: 'Sin agrupación',
      descripcion: 'Insumos sin agrupar',
    });

    console.log('[ensureTodoInsumos] Grupo TODO creado:', created?.data || created);
    return created?.data || created;
  } catch (e) {
    console.error('[ensureTodoInsumos] Error:', e);
    throw e;
  }
}

/**
 * Obtener exclusiones del grupo TODO
 */
export async function getExclusionesInsumos(todoGroupId) {
  try {
    const res = await insumoGroupGetExclusions(todoGroupId);
    return Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    console.error('[getExclusionesInsumos] Error:', e);
    return [];
  }
}

/**
 * Agregar exclusiones (quitar insumos del TODO)
 */
export async function addExclusionesInsumos(todoGroupId, exclusions) {
  try {
    await insumoGroupAddExclusions(todoGroupId, exclusions);
  } catch (e) {
    console.error('[addExclusionesInsumos] Error:', e);
    throw e;
  }
}

/**
 * Quitar exclusiones (volver a agregar insumos al TODO)
 */
export async function removeExclusionesInsumos(todoGroupId, ids) {
  try {
    await insumoGroupRemoveExclusions(todoGroupId, ids, 'insumo');
  } catch (e) {
    console.error('[removeExclusionesInsumos] Error:', e);
    throw e;
  }
}

/**
 * Asegura que existe un grupo "Discontinuados" para insumos
 */
export async function ensureDiscontinuadosInsumos() {
  try {
    const res = await insumoGroupsList();
    const groups = Array.isArray(res?.data) ? res.data : [];

    const discGroup = groups.find(g => {
      const nombre = String(g?.nombre || '').trim().toUpperCase();
      return nombre === 'DISCONTINUADOS' || nombre === 'DESCONTINUADOS';
    });

    if (discGroup) {
      console.log('[ensureDiscontinuadosInsumos] Grupo Discontinuados ya existe:', discGroup.id);
      return discGroup;
    }

    console.log('[ensureDiscontinuadosInsumos] Creando grupo Discontinuados...');
    const created = await insumoGroupCreate({
      nombre: 'Discontinuados',
      descripcion: 'Insumos discontinuados',
    });

    console.log('[ensureDiscontinuadosInsumos] Grupo Discontinuados creado:', created?.data || created);
    return created?.data || created;
  } catch (e) {
    console.error('[ensureDiscontinuadosInsumos] Error:', e);
    throw e;
  }
}

/**
 * Helper para detectar si un grupo es TODO
 */
export function isTodoGroup(g) {
  if (!g) return false;
  const n = String(g?.nombre || '').trim().toUpperCase();
  return (
    n === 'TODO' ||
    n === 'SIN AGRUPACION' ||
    n === 'SIN AGRUPACIÓN' ||
    n === 'SIN AGRUPAR' ||
    n === 'SIN GRUPO'
  );
}

/**
 * Helper para detectar si un grupo es Discontinuados
 */
export function isDiscontinuadosGroup(g) {
  if (!g) return false;
  const n = String(g?.nombre || '').trim().toUpperCase();
  return n === 'DISCONTINUADOS' || n === 'DESCONTINUADOS';
}