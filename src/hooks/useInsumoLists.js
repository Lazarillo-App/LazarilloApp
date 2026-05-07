// src/hooks/useInsumoLists.js
import { useState, useCallback, useEffect } from 'react';
import { httpBiz } from '@/servicios/apiBusinesses';

/**
 * Hook liviano para listas de insumos.
 * Sin lógica de selección/vinculación — solo crear, eliminar, listar, obtener items.
 */
export function useInsumoLists(bizId) {
  const [lists,             setLists]             = useState([]);
  const [loading,           setLoading]           = useState(false);
  const [activeListId,      setActiveListId]      = useState(null);
  const [activeListItems,   setActiveListItems]   = useState(new Set()); // Set<insumo_id>
  const [loadingItems,      setLoadingItems]      = useState(false);

  const load = useCallback(async () => {
    if (!bizId) {
      console.warn('[useInsumoLists] bizId vacío, no carga');
      return;
    }
    setLoading(true);
    try {
      console.log('[useInsumoLists] cargando listas para bizId:', bizId);
      const res = await httpBiz('/insumo-lists', {}, bizId);
      console.log('[useInsumoLists] respuesta:', res);
      setLists(res?.lists || []);
    } catch (e) {
      console.error('[useInsumoLists] load error:', e.message, e);
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  // Cuando cambia el negocio, limpiar lista activa
  useEffect(() => {
    setActiveListId(null);
    setActiveListItems(new Set());
  }, [bizId]);

  const loadListItems = useCallback(async (listId) => {
    if (!bizId || !listId) return;
    setLoadingItems(true);
    try {
      const res = await httpBiz(`/insumo-lists/${listId}/items`, {}, bizId);
      const ids = new Set(
        (res?.items || []).map(i => Number(i.insumo_id)).filter(n => n > 0)
      );
      setActiveListItems(ids);
    } catch (e) {
      console.error('[useInsumoLists] loadListItems error:', e.message);
      setActiveListItems(new Set());
    } finally {
      setLoadingItems(false);
    }
  }, [bizId]);

  const selectList = useCallback((listId) => {
    // Toggle: si clickeás la misma lista la deseleccionás
    if (listId === activeListId) {
      setActiveListId(null);
      setActiveListItems(new Set());
    } else {
      setActiveListId(listId);
      if (listId) loadListItems(listId);
      else setActiveListItems(new Set());
    }
  }, [activeListId, loadListItems]);

  const createList = useCallback(async (name) => {
    if (!name?.trim() || !bizId) return null;
    try {
      const res = await httpBiz('/insumo-lists', { method: 'POST', body: { name: name.trim() } }, bizId);
      if (!res?.list) throw new Error('Respuesta inesperada del servidor');
      setLists(prev => [{ ...res.list, item_count: 0 }, ...prev]);
      return res.list;
    } catch (e) {
      console.error('[useInsumoLists] createList error:', e.message);
      // Re-throw para que el caller (InsumosMain) pueda mostrarlo
      throw e;
    }
  }, [bizId]);

  const deleteList = useCallback(async (listId) => {
    if (!bizId || !listId) return;
    await httpBiz(`/insumo-lists/${listId}`, { method: 'DELETE' }, bizId);
    setLists(prev => prev.filter(l => l.id !== listId));
  }, [bizId]);

  const getItems = useCallback(async (listId) => {
    if (!bizId || !listId) return [];
    const res = await httpBiz(`/insumo-lists/${listId}/items`, {}, bizId);
    return res?.items || [];
  }, [bizId]);

  const addItems = useCallback(async (listId, ids) => {
    if (!bizId || !listId || !ids?.length) return;
    await httpBiz(`/insumo-lists/${listId}/items`, { method: 'PUT', body: { ids } }, bizId);
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, item_count: (l.item_count || 0) + ids.length } : l
    ));
  }, [bizId]);

  return { lists, loading, load, createList, deleteList, getItems, addItems,
           activeListId, activeListItems, loadingItems, selectList };
}