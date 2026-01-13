/* eslint-disable no-empty */
// src/servicios/syncService.js

// 🔧 Control centralizado de Maxi via variable de entorno
// Para habilitar: VITE_MAXI_ENABLED=true en .env
// Para deshabilitar: VITE_MAXI_ENABLED=false en .env
const MAXI_ENABLED = import.meta.env.VITE_MAXI_ENABLED === 'true';

console.log(`[syncService] MAXI_ENABLED: ${MAXI_ENABLED}`);

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
 * ⚠️ TEMPORALMENTE controlado por VITE_MAXI_ENABLED
 */

// ==================== CACHE ====================
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
      ['articulos', 'ventas', 'insumos'].forEach(t => {
        sessionStorage.removeItem(getCacheKey(bizId, t));
      });
    }
  } catch {}
}

// ==================== HELPERS ====================

async function isMaxiConfigured(bizId) {
  try {
    const st = await BusinessesAPI.maxiStatus(bizId);
    return !!st?.configured;
  } catch {
    return false;
  }
}

function emitEvent(eventName, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch (e) {
    console.warn(`[syncService] No se pudo emitir evento ${eventName}:`, e);
  }
}

// ==================== WRAPPER DESHABILITADOR ====================

function preventMaxiSync(fn, name) {
  return async (...args) => {
    if (!MAXI_ENABLED) {
      console.warn(`⚠️ ${name} deshabilitado (VITE_MAXI_ENABLED=false) - usando solo CSV`);
      const opts = args[1] || {};
      opts.onProgress?.(`${name} deshabilitado - usando solo CSV`, 'warning');
      return { ok: false, error: 'maxi_disabled', cached: true };
    }
    return fn(...args);
  };
}

// ==================== SYNC ARTÍCULOS ====================

async function _syncArticulos(bizId, opts = {}) {
  const { force = false, onProgress } = opts;
  
  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncArticulos');
  }

  if (!force && wasAlreadySynced(id, 'articulos')) {
    console.log('[syncArticulos] ⏭️ Usando caché - ya sincronizado en esta sesión');
    onProgress?.('Artículos ya sincronizados en esta sesión', 'info');
    return { ok: true, cached: true };
  }

  console.log(`[syncArticulos] 🔄 Sincronizando (force=${force})...`);
  onProgress?.('Sincronizando artículos…', 'loading');

  try {
    const maxiOk = await isMaxiConfigured(id);
    if (!maxiOk) {
      throw new Error('maxi_not_configured');
    }

    const resp = await BusinessesAPI.syncNow(id, { scope: 'articles' });
    
    const upserted = Number(resp?.upserted ?? 0);
    const mapped = Number(resp?.mapped ?? 0);

    markAsSynced(id, 'articulos');
    emitEvent('business:synced', { bizId: id, type: 'articulos' });
    
    console.log(`[syncArticulos] ✅ OK - upserted: ${upserted}, mapped: ${mapped}`);
    onProgress?.(`Artículos OK · upserted: ${upserted} · mapeos: ${mapped}`, 'success');

    return {
      ok: true,
      upserted,
      mapped,
      cached: false,
    };

  } catch (e) {
    const msg = String(e?.message || '');
    
    let friendly = 'No se pudieron sincronizar artículos';
    if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      friendly = 'Maxi devolvió 401: credenciales inválidas o token caído';
    } else if (msg.includes('maxi_not_configured')) {
      friendly = 'Maxi no configurado. Cargá email, clave y codcli';
    }

    console.error('[syncArticulos] ❌ Error:', friendly);
    onProgress?.(friendly, 'error');
    
    return {
      ok: false,
      error: friendly,
    };
  }
}

// ==================== SYNC VENTAS ====================

async function _syncVentas(bizId, opts = {}) {
  const { days = 7, force = false, onProgress } = opts;
  
  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncVentas');
  }

  if (!force && wasAlreadySynced(id, 'ventas')) {
    console.log('[syncVentas] ⏭️ Usando caché - ya sincronizado en esta sesión');
    onProgress?.('Ventas ya sincronizadas en esta sesión', 'info');
    return { ok: true, cached: true };
  }

  console.log(`[syncVentas] 🔄 Sincronizando últimos ${days} días (force=${force})...`);
  onProgress?.(`Sincronizando ventas (últimos ${days} días)…`, 'loading');

  try {
    const maxiOk = await isMaxiConfigured(id);
    if (!maxiOk) {
      throw new Error('maxi_not_configured');
    }

    const resp = await BusinessesAPI.syncSalesLast7d(id);
    
    const s = resp?.sales || resp || {};
    
    const from = s.from || s.range?.from || s.minDay || '';
    const to = s.to || s.range?.to || s.maxDay || '';
    const upserted = Number(s.upserted ?? 0);
    const updated = Number(s.updated ?? 0);

    markAsSynced(id, 'ventas');
    clearVentasCache();
    emitEvent('ventas:updated', { bizId: id });
    
    console.log(`[syncVentas] ✅ OK - ${from} → ${to}, upserted: ${upserted}, updated: ${updated}`);
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
      cached: false,
    };

  } catch (e) {
    const msg = String(e?.message || '');
    
    let friendly = 'No se pudieron sincronizar ventas';
    if (msg.includes('maxi_not_configured')) {
      friendly = 'Maxi no configurado. Cargá email, clave y codcli';
    } else if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      friendly = 'Maxi devolvió 401: credenciales inválidas';
    }

    console.error('[syncVentas] ❌ Error:', friendly);
    onProgress?.(friendly, 'error');
    
    return {
      ok: false,
      error: friendly,
    };
  }
}

// ==================== SYNC INSUMOS ====================

async function _syncInsumos(bizId, opts = {}) {
  const { force = false, onProgress } = opts;
  
  const id = Number(bizId);
  if (!Number.isFinite(id)) {
    throw new Error('businessId inválido para syncInsumos');
  }

  if (!force && wasAlreadySynced(id, 'insumos')) {
    console.log('[syncInsumos] ⏭️ Usando caché - ya sincronizado en esta sesión');
    onProgress?.('Insumos ya sincronizados en esta sesión', 'info');
    return { ok: true, cached: true };
  }

  console.log(`[syncInsumos] 🔄 Sincronizando (force=${force})...`);
  onProgress?.('Sincronizando insumos…', 'loading');

  try {
    const maxiOk = await isMaxiConfigured(id);
    if (!maxiOk) {
      throw new Error('maxi_not_configured');
    }

    const resSupplies = await insumosSyncMaxi(id);
    const s1 = resSupplies?.summary || resSupplies || {};
    
    const received = Number(s1.received ?? s1.normalized ?? 0);
    const synced = Number(s1.synced ?? s1.total ?? 0);

    const resRubros = await insumosRubrosSync(id);
    const s2 = resRubros?.summary || resRubros || {};
    
    const rubros = Number(s2.count ?? s2.total ?? 0);

    markAsSynced(id, 'insumos');
    emitEvent('business:synced', { bizId: id, type: 'insumos' });
    
    console.log(`[syncInsumos] ✅ OK - received: ${received}, synced: ${synced}, rubros: ${rubros}`);
    onProgress?.(
      `Insumos OK · recibidos: ${received} · sincronizados: ${synced} · rubros: ${rubros}`,
      'success'
    );

    return {
      ok: true,
      received,
      synced,
      rubros,
      cached: false,
    };

  } catch (e) {
    const msg = String(e?.message || '');
    
    let friendly = 'No se pudieron sincronizar insumos';
    if (msg.includes('maxi_not_configured')) {
      friendly = 'Maxi no configurado';
    } else if (msg.includes('401') || msg.includes('UNAUTHORIZED')) {
      friendly = 'Maxi devolvió 401: credenciales inválidas';
    }

    console.error('[syncInsumos] ❌ Error:', friendly);
    onProgress?.(friendly, 'error');
    
    return {
      ok: false,
      error: friendly,
    };
  }
}

// ==================== SYNC COMPLETO ====================

async function _syncAll(bizId, opts = {}) {
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

  console.log(`[syncAll] 🚀 Iniciando sync completo (force=${force})...`);
  onProgress?.('Iniciando sincronización completa…', 'loading', 'init');

  const results = {
    articulos: null,
    ventas: null,
    insumos: null,
  };

  const errors = [];

  if (doArticulos) {
    try {
      results.articulos = await _syncArticulos(id, {
        force,
        onProgress: (msg, type) => onProgress?.(msg, type, 'articulos'),
      });
    } catch (e) {
      errors.push({ step: 'articulos', error: e.message });
    }
  }

  if (doVentas) {
    try {
      results.ventas = await _syncVentas(id, {
        force,
        onProgress: (msg, type) => onProgress?.(msg, type, 'ventas'),
      });
    } catch (e) {
      errors.push({ step: 'ventas', error: e.message });
    }
  }

  if (doInsumos) {
    try {
      results.insumos = await _syncInsumos(id, {
        force,
        onProgress: (msg, type) => onProgress?.(msg, type, 'insumos'),
      });
    } catch (e) {
      errors.push({ step: 'insumos', error: e.message });
    }
  }

  const allOk = errors.length === 0;
  
  if (allOk) {
    console.log('[syncAll] ✅ Sincronización completa exitosa');
    onProgress?.('✅ Sincronización completa exitosa', 'success', 'done');
  } else {
    console.warn(`[syncAll] ⚠️ Sincronización con ${errors.length} error(es):`, errors);
    onProgress?.(`⚠️ Sincronización con ${errors.length} error(es)`, 'warning', 'done');
  }

  return {
    ok: allOk,
    results,
    errors,
  };
}

// ==================== EXPORTS WRAPPED ====================
// 🎯 Si MAXI_ENABLED=false, estas funciones retornan error inmediatamente
// 🎯 Si MAXI_ENABLED=true, funcionan normalmente

export const syncArticulos = preventMaxiSync(_syncArticulos, 'syncArticulos');
export const syncVentas = preventMaxiSync(_syncVentas, 'syncVentas');
export const syncInsumos = preventMaxiSync(_syncInsumos, 'syncInsumos');
export const syncAll = preventMaxiSync(_syncAll, 'syncAll');

export { clearSyncCache, wasAlreadySynced, isMaxiConfigured };