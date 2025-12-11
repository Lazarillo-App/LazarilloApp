/* eslint-disable no-empty */
// src/servicios/syncService.js

import { BusinessesAPI } from './apiBusinesses';
import { insumosSyncMaxi, insumosRubrosSync } from './apiInsumos';
import { clearVentasCache } from './apiVentas';

/**
 * 🔄 Servicio centralizado de sincronización
 * 
 * Maneja:
 * - Artículos (catálogo desde Maxi)
 * - Ventas (últimos 7 días por defecto)
 * - Insumos (desde Maxi)
 * 
 * Con:
 * - Cache en sessionStorage para evitar duplicados en la misma sesión
 * - Notificaciones consistentes
 * - Estado de loading centralizado
 */

// ==================== CACHE ====================
// Evita re-sincronizar el mismo negocio múltiples veces en la misma sesión
const getCacheKey = (bizId, type) => `lazarillo:autoSync:${bizId}:${type}`;

function wasAlreadySynced(bizId, type) {
  try {
    const key = getCacheKey(bizId, type);
    return sessionStorage.getItem(key) === 'done';
  } catch {
    return false;
  }
}

function markAsSynced(bizId, type) {
  try {
    const key = getCacheKey(bizId, type);
    sessionStorage.setItem(key, 'done');
  } catch {}
}

function clearSyncCache(bizId, type = null) {
  try {
    if (type) {
      sessionStorage.removeItem(getCacheKey(bizId, type));
    } else {
      // Limpiamos todos los tipos para este negocio
      ['articulos', 'ventas', 'insumos'].forEach(t => {
        sessionStorage.removeItem(getCacheKey(bizId, t));
      });
    }
  } catch {}
}

// ==================== HELPERS ====================

/**
 * Verifica si Maxi está configurado para un negocio
 */
async function isMaxiConfigured(bizId) {
  try {
    const st = await BusinessesAPI.maxiStatus(bizId);
    return !!st?.configured;
  } catch {
    return false;
  }
}

/**
 * Emite eventos globales para notificar cambios
 */
function emitEvent(eventName, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch (e) {
    console.warn(`[syncService] No se pudo emitir evento ${eventName}:`, e);
  }
}

// ==================== SYNC ARTÍCULOS ====================

/**
 * Sincroniza artículos (catálogo) desde Maxi
 * 
 * @param {number|string} bizId - ID del negocio
 * @param {object} opts - Opciones
 * @param {boolean} opts.force - Forzar sync aunque ya se haya hecho
 * @param {function} opts.onProgress - Callback de progreso (msg, type)
 * @returns {Promise<object>} - { ok, upserted, mapped, error }
 */
export async function syncArticulos(bizId, opts = {}) {
  const { force = false, onProgress } = opts;
  
  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncArticulos');
  }

  // 🔍 Check cache
  if (!force && wasAlreadySynced(id, 'articulos')) {
    onProgress?.('Artículos ya sincronizados en esta sesión', 'info');
    return { ok: true, cached: true };
  }

  onProgress?.('Sincronizando artículos…', 'loading');

  try {
    // 🔧 Verificar Maxi
    const maxiOk = await isMaxiConfigured(id);
    if (!maxiOk) {
      throw new Error('maxi_not_configured');
    }

    // 🔄 Sincronizar
    const resp = await BusinessesAPI.syncNow(id, { scope: 'articles' });
    
    const upserted = Number(resp?.upserted ?? 0);
    const mapped = Number(resp?.mapped ?? 0);

    // ✅ Éxito
    markAsSynced(id, 'articulos');
    emitEvent('business:synced', { bizId: id, type: 'articulos' });
    
    onProgress?.(`Artículos OK · upserted: ${upserted} · mapeos: ${mapped}`, 'success');

    return {
      ok: true,
      upserted,
      mapped,
    };

  } catch (e) {
    const msg = String(e?.message || '');
    
    let friendly = 'No se pudieron sincronizar artículos';
    if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      friendly = 'Maxi devolvió 401: credenciales inválidas o token caído';
    } else if (msg.includes('maxi_not_configured')) {
      friendly = 'Maxi no configurado. Cargá email, clave y codcli';
    }

    onProgress?.(friendly, 'error');
    
    return {
      ok: false,
      error: friendly,
    };
  }
}

// ==================== SYNC VENTAS ====================

/**
 * Sincroniza ventas de los últimos N días (default 7)
 * 
 * @param {number|string} bizId - ID del negocio
 * @param {object} opts - Opciones
 * @param {number} opts.days - Días a sincronizar (default 7)
 * @param {boolean} opts.force - Forzar sync
 * @param {function} opts.onProgress - Callback de progreso
 * @returns {Promise<object>} - { ok, from, to, upserted, updated, error }
 */
export async function syncVentas(bizId, opts = {}) {
  const { days = 7, force = false, onProgress } = opts;
  
  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncVentas');
  }

  // 🔍 Check cache
  if (!force && wasAlreadySynced(id, 'ventas')) {
    onProgress?.('Ventas ya sincronizadas en esta sesión', 'info');
    return { ok: true, cached: true };
  }

  onProgress?.(`Sincronizando ventas (últimos ${days} días)…`, 'loading');

  try {
    // 🔧 Verificar Maxi
    const maxiOk = await isMaxiConfigured(id);
    if (!maxiOk) {
      throw new Error('maxi_not_configured');
    }

    // 🔄 Sincronizar
    const resp = await BusinessesAPI.syncSalesLast7d(id);
    
    // Soportar ambas estructuras de respuesta
    const s = resp?.sales || resp || {};
    
    const from = s.from || s.range?.from || s.minDay || '';
    const to = s.to || s.range?.to || s.maxDay || '';
    const upserted = Number(s.upserted ?? 0);
    const updated = Number(s.updated ?? 0);

    // ✅ Éxito
    markAsSynced(id, 'ventas');
    clearVentasCache(); // Invalidar cache de ventas
    emitEvent('ventas:updated', { bizId: id });
    
    onProgress?.(
      `Ventas OK · ${from} → ${to} · upserted: ${upserted} · updated: ${updated}`,
      'success'
    );

    return {
      ok: true,
      from,
      to,
      upserted,
      updated,
    };

  } catch (e) {
    const msg = String(e?.message || '');
    
    let friendly = 'No se pudieron sincronizar ventas';
    if (msg.includes('maxi_not_configured')) {
      friendly = 'Maxi no configurado. Cargá email, clave y codcli';
    } else if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      friendly = 'Maxi devolvió 401: credenciales inválidas';
    }

    onProgress?.(friendly, 'error');
    
    return {
      ok: false,
      error: friendly,
    };
  }
}

// ==================== SYNC INSUMOS ====================

/**
 * Sincroniza insumos desde Maxi
 * 
 * @param {number|string} bizId - ID del negocio
 * @param {object} opts - Opciones
 * @param {boolean} opts.force - Forzar sync
 * @param {function} opts.onProgress - Callback de progreso
 * @returns {Promise<object>} - { ok, received, synced, rubros, error }
 */
export async function syncInsumos(bizId, opts = {}) {
  const { force = false, onProgress } = opts;
  
  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncInsumos');
  }

  // 🔍 Check cache
  if (!force && wasAlreadySynced(id, 'insumos')) {
    onProgress?.('Insumos ya sincronizados en esta sesión', 'info');
    return { ok: true, cached: true };
  }

  onProgress?.('Sincronizando insumos…', 'loading');

  try {
    // 🔧 Verificar Maxi
    const maxiOk = await isMaxiConfigured(id);
    if (!maxiOk) {
      throw new Error('maxi_not_configured');
    }

    // 🔄 Sincronizar insumos
    const resSupplies = await insumosSyncMaxi(id);
    const s1 = resSupplies?.summary || resSupplies || {};
    
    const received = Number(s1.received ?? s1.normalized ?? 0);
    const synced = Number(s1.synced ?? s1.total ?? 0);

    // 🔄 Sincronizar rubros
    const resRubros = await insumosRubrosSync(id);
    const s2 = resRubros?.summary || resRubros || {};
    
    const rubros = Number(s2.count ?? s2.total ?? 0);

    // ✅ Éxito
    markAsSynced(id, 'insumos');
    emitEvent('business:synced', { bizId: id, type: 'insumos' });
    
    onProgress?.(
      `Insumos OK · recibidos: ${received} · sincronizados: ${synced} · rubros: ${rubros}`,
      'success'
    );

    return {
      ok: true,
      received,
      synced,
      rubros,
    };

  } catch (e) {
    const msg = String(e?.message || '');
    
    let friendly = 'No se pudieron sincronizar insumos';
    if (msg.includes('maxi_not_configured')) {
      friendly = 'Maxi no configurado';
    } else if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      friendly = 'Maxi devolvió 401: credenciales inválidas';
    }

    onProgress?.(friendly, 'error');
    
    return {
      ok: false,
      error: friendly,
    };
  }
}

// ==================== SYNC COMPLETO ====================

/**
 * Sincroniza TODO (artículos + ventas + insumos) en un negocio
 * 
 * @param {number|string} bizId - ID del negocio
 * @param {object} opts - Opciones
 * @param {boolean} opts.force - Forzar sync aunque ya se haya hecho
 * @param {boolean} opts.articulos - Sincronizar artículos (default true)
 * @param {boolean} opts.ventas - Sincronizar ventas (default true)
 * @param {boolean} opts.insumos - Sincronizar insumos (default true)
 * @param {function} opts.onProgress - Callback de progreso (msg, type, step)
 * @returns {Promise<object>} - { ok, results: {articulos, ventas, insumos}, errors }
 */
export async function syncAll(bizId, opts = {}) {
  const {
    force = false,
    articulos: doArticulos = true,
    ventas: doVentas = true,
    insumos: doInsumos = true,
    onProgress,
  } = opts;

  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncAll');
  }

  onProgress?.('Iniciando sincronización completa…', 'loading', 'init');

  const results = {
    articulos: null,
    ventas: null,
    insumos: null,
  };

  const errors = [];

  // 1️⃣ Artículos
  if (doArticulos) {
    try {
      results.articulos = await syncArticulos(id, {
        force,
        onProgress: (msg, type) => onProgress?.(msg, type, 'articulos'),
      });
    } catch (e) {
      errors.push({ step: 'articulos', error: e.message });
    }
  }

  // 2️⃣ Ventas
  if (doVentas) {
    try {
      results.ventas = await syncVentas(id, {
        force,
        onProgress: (msg, type) => onProgress?.(msg, type, 'ventas'),
      });
    } catch (e) {
      errors.push({ step: 'ventas', error: e.message });
    }
  }

  // 3️⃣ Insumos
  if (doInsumos) {
    try {
      results.insumos = await syncInsumos(id, {
        force,
        onProgress: (msg, type) => onProgress?.(msg, type, 'insumos'),
      });
    } catch (e) {
      errors.push({ step: 'insumos', error: e.message });
    }
  }

  // 🎯 Resumen final
  const allOk = errors.length === 0;
  
  if (allOk) {
    onProgress?.('✅ Sincronización completa exitosa', 'success', 'done');
  } else {
    onProgress?.(`⚠️ Sincronización con ${errors.length} error(es)`, 'warning', 'done');
  }

  return {
    ok: allOk,
    results,
    errors,
  };
}

// ==================== UTILS PÚBLICOS ====================

export { clearSyncCache, wasAlreadySynced, isMaxiConfigured };