/* eslint-disable no-empty */
// src/hooks/useArticleSelection.js
//
// Maneja todo el estado de selección de artículos:
//   - Modo activo ('list' | 'link' | null)
//   - Set de IDs seleccionados
//   - CRUD de listas (con backend)
//   - CRUD de vinculaciones (con backend)
//   - Mapa de link groups por artículo (para mostrar ícono de cadena)

import { useState, useCallback, useEffect, useMemo } from 'react';
import { BASE } from '@/servicios/apiBase';
import { deleteReceta } from '@/servicios/apiOrganizations';

const authHeaders = (bizId) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  'X-Business-Id': String(bizId || ''),
});

// ─── API helpers ────────────────────────────────────────────────────────────

const ListsAPI = {
  getAll: async (bizId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-lists`, { headers: authHeaders(bizId) });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { lists: [{id, name, color, item_count}] }
  },
  create: async (bizId, { name, color }) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-lists`, {
      method: 'POST', headers: authHeaders(bizId),
      body: JSON.stringify({ name, color }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { list: {id, name, color} }
  },
  addItems: async (bizId, listId, ids) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-lists/${listId}/items`, {
      method: 'PUT', headers: authHeaders(bizId),
      body: JSON.stringify({ ids }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  getItems: async (bizId, listId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-lists/${listId}/items`, { headers: authHeaders(bizId) });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { items: [{article_id}] }
  },
  delete: async (bizId, listId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-lists/${listId}`, {
      method: 'DELETE', headers: authHeaders(bizId),
    });
    if (!r.ok) throw new Error(await r.text());
  },
  removeItem: async (bizId, listId, articleId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-lists/${listId}/items/${articleId}`, {
      method: 'DELETE', headers: authHeaders(bizId),
    });
    if (!r.ok) throw new Error(await r.text());
  },
};

const LinksAPI = {
  getAll: async (bizId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-links`, { headers: authHeaders(bizId) });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { groups: [{id, name, members: [{article_id}]}] }
  },
  create: async (bizId, { articleIds, name }) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-links`, {
      method: 'POST', headers: authHeaders(bizId),
      body: JSON.stringify({ articleIds, name }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { group: {id, members: []} }
  },
  deleteGroup: async (bizId, groupId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-links/${groupId}`, {
      method: 'DELETE', headers: authHeaders(bizId),
    });
    if (!r.ok) throw new Error(await r.text());
  },
  removeMember: async (bizId, groupId, articleId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-links/${groupId}/members/${articleId}`, {
      method: 'DELETE', headers: authHeaders(bizId),
    });
    if (!r.ok) throw new Error(await r.text());
  },
  addMember: async (bizId, groupId, articleId) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-links/${groupId}/members`, {
      method: 'POST', headers: authHeaders(bizId),
      body: JSON.stringify({ articleId }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      throw new Error(errBody);
    }
    return r.json();
  },
  getPropagations: async (bizId, limit = 20) => {
    const r = await fetch(`${BASE}/businesses/${bizId}/article-links/propagations?limit=${limit}`, { headers: authHeaders(bizId) });
    if (!r.ok) throw new Error(await r.text());
    return r.json(); // { propagations: [{...}] }
  },
};

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useArticleSelection({ bizId, notify, onLinkPropagated }) {
  // ── Modo de selección ──
  const [selectionMode, setSelectionMode] = useState(null); // null | 'list' | 'link'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // ── Listas ──
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [activeListId, setActiveListId] = useState(null); // lista activa en sidebar
  const [activeListItems, setActiveListItems] = useState(new Set()); // IDs en la lista activa

  // ── Vinculaciones ──
  // linkByArticleId: Map<articleId, Array<{ groupId, groupName, linkType, memberIds: Set, sync_recipe, sync_precio, sync_objetivo }>>
  const [linkGroups, setLinkGroups] = useState([]);
  const linkByArticleId = useMemo(() => {
    const m = new Map();
    for (const g of linkGroups) {
      const memberIds = new Set((g.members || []).map(mm => Number(mm.article_id)));
      const entry = {
        groupId: g.id,
        groupName: g.name,
        linkType: g.link_type ?? (g.sync_precio ? 'precio' : g.sync_recipe ? 'receta' : g.sync_objetivo ? 'objetivo' : null),
        sync_recipe: !!g.sync_recipe,
        sync_precio: !!g.sync_precio,
        sync_objetivo: !!g.sync_objetivo,
        memberIds,
      };
      for (const id of memberIds) {
        const arr = m.get(id) || [];
        arr.push(entry);
        m.set(id, arr);
      }
    }
    return m;
  }, [linkGroups]);

  // ── Cargar listas y vinculaciones al montar / cambiar negocio ──────────
  useEffect(() => {
    if (!bizId) { setLists([]); setLinkGroups([]); return; }

    let alive = true;
    (async () => {
      setLoadingLists(true);
      try {
        const [listsRes, linksRes] = await Promise.all([
          ListsAPI.getAll(bizId).catch(() => ({ lists: [] })),
          LinksAPI.getAll(bizId).catch(() => ({ groups: [] })),
        ]);
        if (!alive) return;
        setLists((listsRes?.lists || []).filter(l => !l.is_favorite));
        setLinkGroups(linksRes?.groups || []);
      } finally {
        if (alive) setLoadingLists(false);
      }
    })();
    return () => { alive = false; };
  }, [bizId]);

  // ── Escuchar propagaciones desde el backend (via evento global) ────────
  useEffect(() => {
    const onProp = (e) => {
      const { groupId, count, changeType } = e.detail || {};
      const typeLabel = changeType === 'recipe' ? 'receta'
        : changeType === 'objetivo' ? 'objetivo %'
          : 'precio manual';
      notify?.(`🔗 ${typeLabel} aplicada a ${count} artículo${count !== 1 ? 's' : ''} vinculado${count !== 1 ? 's' : ''}`);
      onLinkPropagated?.({ groupId, count, changeType });
    };
    window.addEventListener('article:link-propagated', onProp);
    return () => window.removeEventListener('article:link-propagated', onProp);
  }, [notify, onLinkPropagated]);

  // ── Escuchar cambios en vínculos (creación/modificación desde modales) ──
  useEffect(() => {
    if (!bizId) return;
    const onLinksChanged = async () => {
      try {
        const r = await LinksAPI.getAll(bizId);
        console.log('[onLinksChanged] nuevo linkGroups:', r?.groups?.length, 'grupos');
        setLinkGroups(r?.groups || []);
      } catch (e) {
        console.warn('[useArticleSelection] reload links failed:', e.message);
      }
    };
    window.addEventListener('article:links-changed', onLinksChanged);
    return () => window.removeEventListener('article:links-changed', onLinksChanged);
  }, [bizId]);

  // ── Selección ──────────────────────────────────────────────────────────
  const toggleSelected = useCallback((id) => {
    const n = Number(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setSelectedIds(new Set(ids.map(Number)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleMode = useCallback((mode) => {
    setSelectionMode(mode);
    if (!mode) setSelectedIds(new Set());
  }, []);

  // ── CRUD Listas ────────────────────────────────────────────────────────
  const createList = useCallback(async (name) => {
    if (!bizId || !name.trim()) return;
    setSaving(true);
    try {
      const res = await ListsAPI.create(bizId, { name: name.trim() });
      const newList = res?.list;
      if (!newList) throw new Error('Respuesta inesperada');

      // Agregar los artículos seleccionados a la nueva lista
      if (selectedIds.size > 0) {
        await ListsAPI.addItems(bizId, newList.id, Array.from(selectedIds));
      }

      setLists(prev => [...prev, { ...newList, item_count: selectedIds.size }]);
      notify?.(`✅ Lista "${name}" creada con ${selectedIds.size} artículo${selectedIds.size !== 1 ? 's' : ''}`);
      clearSelection();
      toggleMode(null);
      return newList;
    } catch (e) {
      console.error('[createList]', e);
      notify?.(`Error al crear lista: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [bizId, selectedIds, notify, clearSelection, toggleMode]);

  const addToExistingList = useCallback(async (listId) => {
    if (!bizId || selectedIds.size === 0) return;
    setSaving(true);
    try {
      await ListsAPI.addItems(bizId, listId, Array.from(selectedIds));
      const list = lists.find(l => l.id === listId);
      notify?.(`✅ ${selectedIds.size} artículo${selectedIds.size !== 1 ? 's' : ''} agregado${selectedIds.size !== 1 ? 's' : ''} a "${list?.name || 'lista'}"`);
      clearSelection();
      toggleMode(null);
    } catch (e) {
      console.error('[addToExistingList]', e);
      notify?.(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [bizId, selectedIds, lists, notify, clearSelection, toggleMode]);

  const deleteList = useCallback(async (listId) => {
    if (!bizId) return;
    // Guard extra: no intentar borrar favoritas
    const list = lists.find(l => l.id === listId);
    if (list?.is_favorite) {
      notify?.('Esta lista no se puede eliminar');
      return;
    }
    try {
      await ListsAPI.delete(bizId, listId);
      setLists(prev => prev.filter(l => l.id !== listId));
      if (activeListId === listId) setActiveListId(null);
      notify?.('Lista eliminada');
    } catch (e) {
      console.error('[deleteList]', e);
      notify?.(`Error: ${e.message}`);
    }
  }, [bizId, activeListId, notify]);

  const loadListItems = useCallback(async (listId) => {
    if (!bizId || !listId) { setActiveListItems(new Set()); return; }
    try {
      const res = await ListsAPI.getItems(bizId, listId);
      const ids = new Set((res?.items || []).map(i => Number(i.article_id)));
      setActiveListItems(ids);
    } catch (e) {
      console.error('[loadListItems]', e);
      setActiveListItems(new Set());
    }
  }, [bizId]);

  const selectList = useCallback((listId) => {
    setActiveListId(listId);
    if (listId) loadListItems(listId);
    else setActiveListItems(new Set());
  }, [loadListItems]);

  // ── CRUD Vinculaciones ─────────────────────────────────────────────────
  const createLink = useCallback(async () => {
    if (!bizId || selectedIds.size < 2) {
      notify?.('Seleccioná al menos 2 artículos para vincular');
      return;
    }

    // Verificar que ninguno ya esté en una vinculación DE PRECIO
    // (estar en una de receta u objetivo no bloquea — son tipos independientes)
    const alreadyLinkedByPrecio = Array.from(selectedIds).filter(id => {
      const groups = linkByArticleId.get(Number(id)) || [];
      return groups.some(g => g.linkType === 'precio');
    });
    if (alreadyLinkedByPrecio.length > 0) {
      notify?.(`${alreadyLinkedByPrecio.length} artículo${alreadyLinkedByPrecio.length !== 1 ? 's' : ''} ya est${alreadyLinkedByPrecio.length !== 1 ? 'án' : 'á'} vinculado${alreadyLinkedByPrecio.length !== 1 ? 's' : ''} por precio. Desvinculá primero.`);
      return;
    }

    setSaving(true);
    try {
      const res = await LinksAPI.create(bizId, { articleIds: Array.from(selectedIds) });
      const group = res?.group;
      if (!group) throw new Error('Respuesta inesperada');

      setLinkGroups(prev => [...prev, {
        ...group,
        members: Array.from(selectedIds).map(id => ({ article_id: id })),
      }]);

      notify?.(`🔗 ${selectedIds.size} artículos vinculados correctamente`);
      clearSelection();
      toggleMode(null);
      return group;
    } catch (e) {
      console.error('[createLink]', e);
      notify?.(`Error al vincular: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [bizId, selectedIds, linkByArticleId, notify, clearSelection, toggleMode]);

  const deleteLink = useCallback(async (groupId) => {
    if (!bizId) return;
    try {
      await LinksAPI.deleteGroup(bizId, groupId);
      setLinkGroups(prev => prev.filter(g => g.id !== groupId));
      notify?.('Vinculación eliminada. Los artículos ya son independientes.');
    } catch (e) {
      console.error('[deleteLink]', e);
      notify?.(`Error: ${e.message}`);
    }
  }, [bizId, notify]);

  const removeMemberFromLink = useCallback(async (groupId, articleId) => {
    if (!bizId) return;
    try {
      await LinksAPI.removeMember(bizId, groupId, articleId);

      // Borrar la receta del artículo desvinculado (consistente con quitarGemelo del RecetaModal)
      await deleteReceta(bizId, articleId).catch(e =>
        console.warn('[removeMemberFromLink] no se pudo borrar receta:', e.message)
      );

      setLinkGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return { ...g, members: (g.members || []).filter(m => Number(m.article_id) !== Number(articleId)) };
      }));

      // Avisar a la tabla para que refresque los íconos de vinculación y costos
      try { window.dispatchEvent(new CustomEvent('article:links-changed')); } catch { }

      notify?.('Artículo desvinculado');
    } catch (e) {
      console.error('[removeMemberFromLink]', e);
      notify?.(`Error: ${e.message}`);
    }
  }, [bizId, notify]);

  const addArticlesToLink = useCallback(async (groupId, articleIds) => {
    if (!bizId || !groupId || !articleIds?.length) return;
    setSaving(true);
    const results = { ok: [], errors: [] };
    try {
      for (const id of articleIds) {
        try {
          await LinksAPI.addMember(bizId, groupId, Number(id));
          results.ok.push(Number(id));
        } catch (e) {
          console.warn(`[addArticlesToLink] ${id} falló:`, e.message);
          results.errors.push({ id: Number(id), error: e.message });
        }
      }
      // Actualizar state optimistamente
      setLinkGroups(prev => prev.map(g => {
        if (Number(g.id) !== Number(groupId)) return g;
        const existing = new Set((g.members || []).map(m => Number(m.article_id)));
        const nuevos = results.ok.filter(id => !existing.has(id)).map(id => ({ article_id: id }));
        return { ...g, members: [...(g.members || []), ...nuevos] };
      }));

      if (results.ok.length) {
        notify?.(`🔗 ${results.ok.length} artículo${results.ok.length !== 1 ? 's' : ''} agregado${results.ok.length !== 1 ? 's' : ''} a la vinculación`);
      }
      if (results.errors.length) {
        notify?.(`${results.errors.length} artículo${results.errors.length !== 1 ? 's' : ''} no se pudo agregar`, 'error');
      }
      return results;
    } finally {
      setSaving(false);
    }
  }, [bizId, notify]);

  return {
    // Selección
    selectionMode, selectedIds, saving,
    toggleMode, toggleSelected, selectAll, clearSelection,

    // Listas
    lists, loadingLists, activeListId, activeListItems,
    createList, addToExistingList, deleteList, selectList,

    // Vinculaciones
    linkGroups, linkByArticleId,
    createLink, deleteLink, removeMemberFromLink, addArticlesToLink,
  };
}

// Re-exportar APIs por si el backend las necesita directo
export { ListsAPI, LinksAPI };