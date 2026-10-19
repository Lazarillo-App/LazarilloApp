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
import { esTodoGroup, esDiscontinuadosGroup, esElaboradosGroup } from '@/utils/insumoGruposEspeciales';

const esTodoNombre = (nombre) => esTodoGroup({ nombre });
const esDiscNombre = (nombre) => esDiscontinuadosGroup({ nombre });
const esElabNombre = (nombre) => esElaboradosGroup({ nombre });

function assertBusinessId(businessId, fnName) {
  const n = Number(businessId);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`[${fnName}] businessId inválido: ${businessId}`);
  }
  return n;
}

/**
 * Asegura que existe un grupo "Sin agrupación" (TODO) para insumos (POR NEGOCIO)
 */
export async function ensureTodoInsumos(businessId) {
  const bId = assertBusinessId(businessId, 'ensureTodoInsumos');

  const res = await insumoGroupsList(bId);
  const groups = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

  const todoGroup = groups.find((g) => esTodoNombre(g?.nombre));
  if (todoGroup) return todoGroup;

  const created = await insumoGroupCreate(bId, {
    nombre: 'Sin agrupación',
    descripcion: 'Insumos sin agrupar',
    // 🟡 opcional según backend:
    // scope: 'insumo',
  });

  return created?.data || created;
}

/**
 * Obtener exclusiones del grupo TODO (POR NEGOCIO)
 */
export async function getExclusionesInsumos(businessId, todoGroupId) {
  const bId = assertBusinessId(businessId, 'getExclusionesInsumos');

  try {
    const res = await insumoGroupGetExclusions(bId, todoGroupId);
    return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (e) {
    console.error('[getExclusionesInsumos] Error:', e);
    return [];
  }
}

/**
 * Agregar exclusiones (quitar insumos del TODO)
 */
export async function addExclusionesInsumos(businessId, todoGroupId, exclusions) {
  const bId = assertBusinessId(businessId, 'addExclusionesInsumos');

  try {
    await insumoGroupAddExclusions(bId, todoGroupId, exclusions);
  } catch (e) {
    console.error('[addExclusionesInsumos] Error:', e);
    throw e;
  }
}

/**
 * Quitar exclusiones (volver a agregar insumos al TODO)
 */
export async function removeExclusionesInsumos(businessId, todoGroupId, ids) {
  const bId = assertBusinessId(businessId, 'removeExclusionesInsumos');

  try {
    await insumoGroupRemoveExclusions(bId, todoGroupId, ids, 'insumo');
  } catch (e) {
    console.error('[removeExclusionesInsumos] Error:', e);
    throw e;
  }
}

/**
 * Asegura que existe un grupo "Discontinuados" para insumos (POR NEGOCIO)
 */
export async function ensureDiscontinuadosInsumos(businessId) {
  const bId = assertBusinessId(businessId, 'ensureDiscontinuadosInsumos');

  const res = await insumoGroupsList(bId);
  const groups = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

  const discGroup = groups.find((g) => esDiscNombre(g?.nombre));
  if (discGroup) return discGroup;

  const created = await insumoGroupCreate(bId, {
    nombre: 'Discontinuados',
    descripcion: 'Insumos discontinuados',
    // 🟡 opcional según backend:
    // scope: 'insumo',
  });

  return created?.data || created;
}

/**
 * Asegura que existe un grupo "Elaborados" para insumos (POR NEGOCIO). A
 * diferencia de Discontinuados, su contenido no se asigna a mano acá: se
 * calcula en el frontend con `esInsumoElaborado` (ver insumoGruposEspeciales.js)
 * — esta fila solo le da un id real para aparecer en el desplegable con
 * favorito, igual que las demás agrupaciones fijas.
 */
export async function ensureElaboradosInsumos(businessId) {
  const bId = assertBusinessId(businessId, 'ensureElaboradosInsumos');

  const res = await insumoGroupsList(bId);
  const groups = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

  const elabGroup = groups.find((g) => esElabNombre(g?.nombre));
  if (elabGroup) return elabGroup;

  const created = await insumoGroupCreate(bId, {
    nombre: 'Elaborados',
    descripcion: 'Insumos elaborados (con receta propia) — contenido calculado automáticamente',
  });

  return created?.data || created;
}

/**
 * Helper para detectar si un grupo es TODO
 */
export function isTodoGroup(g) {
  return esTodoNombre(g?.nombre);
}

/**
 * Helper para detectar si un grupo es Discontinuados
 */
export function isDiscontinuadosGroup(g) {
  return esDiscNombre(g?.nombre);
}

/**
 * Helper para detectar si un grupo es Elaborados
 */
export function isElaboradosGroup(g) {
  return esElabNombre(g?.nombre);
}
