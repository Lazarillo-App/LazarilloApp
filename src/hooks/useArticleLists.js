// src/hooks/useArticleLists.js
// Hook centralizado para listas de precios del modelo nuevo.
// - Carga listas + ajustes en un solo request (fullState).
// - Persiste la lista activa por business en localStorage.
// - Expone helper calcPrecio() con jerarquía artículo > rubro > agrupación > lista.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PriceListsAPI } from '@/servicios/apiPriceLists';

const lsKey = (bizId) => `lazarillo:currentArticleListId:${bizId || 'default'}`;

export function useArticleLists(bizId) {
  const [lists, setLists] = useState([]);
  const [byList, setByList] = useState({ _base: { byArticle: {}, byRubro: {}, byAgrupacion: {} } });
  const [currentListId, setCurrentListIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ── Cargar listas + ajustes ── */
  const reload = useCallback(async () => {
    if (!bizId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await PriceListsAPI.fullState(bizId);
      const ls = Array.isArray(res?.lists) ? res.lists : [];
      const bl = res?.byList || { _base: { byArticle: {}, byRubro: {}, byAgrupacion: {} } };
      setLists(ls);
      setByList(bl);

      // Resolver lista activa: localStorage > favorita > primera
      const stored = Number(localStorage.getItem(lsKey(bizId)) || NaN);
      const exists = ls.some(l => Number(l.id) === stored);
      const fav = ls.find(l => l.is_favorite);
      const target = exists ? stored : (fav?.id ?? ls[0]?.id ?? null);
      setCurrentListIdState(target);
    } catch (e) {
      setError(e.message || 'Error cargando listas');
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => { reload(); }, [reload]);

  /* ── Cambiar lista activa (con persistencia) ── */
  const setCurrentList = useCallback((id) => {
    const n = Number(id);
    setCurrentListIdState(n);
    try {
      if (Number.isFinite(n)) localStorage.setItem(lsKey(bizId), String(n));
      else localStorage.removeItem(lsKey(bizId));
    } catch { /* ignore */ }
  }, [bizId]);

  /* ── Listeners para refrescar cuando el modal de config guarda cambios ── */
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('article-lists:updated', handler);
    return () => window.removeEventListener('article-lists:updated', handler);
  }, [reload]);

  /* ── Listas derivadas ── */
  const favoriteList = useMemo(() => lists.find(l => l.is_favorite) || null, [lists]);
  const currentList = useMemo(
    () => lists.find(l => Number(l.id) === Number(currentListId)) || favoriteList,
    [lists, currentListId, favoriteList]
  );
  const isFavoriteActive = useMemo(
    () => currentList?.is_favorite === true,
    [currentList]
  );

  /* ── Resolver % de ajuste efectivo para un artículo en una lista ──
     Jerarquía: artículo > rubro > agrupación > lista global.
     En cada nivel: override explícito por lista pisa la exclusión global (_base). */
  const resolveAjuste = useCallback((articleId, rubroKey, agrupacionId, listId) => {
    const id = Number(listId);
    const cfg = byList[id];
    const base = byList._base || { byArticle: {}, byRubro: {}, byAgrupacion: {} };
    const artKey = String(articleId);

    // hasExplicit: la entry tiene excluido definido (true o false) → pisa _base.
    const hasExplicit = (entry) =>
      entry && entry.excluido != null;

    // 1) Nivel artículo
    {
      const cfgArt = cfg?.byArticle?.[artKey];
      if (hasExplicit(cfgArt)) {
        if (cfgArt.excluido === true) return { ajuste: 0, excluido: true };
        // excluido === false explícito → pisa _base, sigue al ajuste
      } else {
        const baseArt = base.byArticle?.[artKey];
        if (baseArt?.excluido === true) return { ajuste: 0, excluido: true };
      }
      if (cfgArt?.ajuste != null) return { ajuste: cfgArt.ajuste, excluido: false };
    }

    // 2) Nivel rubro
    if (rubroKey) {
      const cfgRubro = cfg?.byRubro?.[String(rubroKey)];
      if (hasExplicit(cfgRubro)) {
        if (cfgRubro.excluido === true) return { ajuste: 0, excluido: true };
      } else {
        const baseRubro = base.byRubro?.[String(rubroKey)];
        if (baseRubro?.excluido === true) return { ajuste: 0, excluido: true };
      }
      if (cfgRubro?.ajuste != null) return { ajuste: cfgRubro.ajuste, excluido: false };
    }

    // 3) Nivel agrupación
    if (agrupacionId) {
      const cfgAgrup = cfg?.byAgrupacion?.[String(agrupacionId)];
      if (hasExplicit(cfgAgrup)) {
        if (cfgAgrup.excluido === true) return { ajuste: 0, excluido: true };
      } else {
        const baseAgrup = base.byAgrupacion?.[String(agrupacionId)];
        if (baseAgrup?.excluido === true) return { ajuste: 0, excluido: true };
      }
      if (cfgAgrup?.ajuste != null) return { ajuste: cfgAgrup.ajuste, excluido: false };
    }

    // 4) Ajuste global de la lista
    const list = lists.find(l => Number(l.id) === id);
    return { ajuste: Number(list?.ajuste_pct) || 0, excluido: false };
  }, [byList, lists]);
  
  /* ── Calcular precio mostrado: precioBase × (1 + ajuste/100) ──
     Si listId es la favorita o no se pasa, devuelve precioBase tal cual. */
  const calcPrecio = useCallback((precioBase, articleId, rubroKey, agrupacionId, listId = currentListId) => {
    const id = Number(listId);
    const list = lists.find(l => Number(l.id) === id);
    if (!list || list.is_favorite) return { precio: Number(precioBase) || 0, excluido: false, ajuste: 0 };

    const { ajuste, excluido } = resolveAjuste(articleId, rubroKey, agrupacionId, id);
    if (excluido) {
      // Misma plata que la favorita
      return { precio: Number(precioBase) || 0, excluido: true, ajuste: 0 };
    }
    const precio = (Number(precioBase) || 0) * (1 + Number(ajuste) / 100);
    return { precio, excluido: false, ajuste };
  }, [lists, currentListId, resolveAjuste]);

  return {
    lists,
    byList,
    favoriteList,
    currentList,
    currentListId,
    setCurrentList,
    isFavoriteActive,
    calcPrecio,
    resolveAjuste,
    reload,
    loading,
    error,
  };
}

export default useArticleLists;
