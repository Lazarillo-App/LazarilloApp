// src/servicios/apiArticleLists.js
// API del modelo nuevo de listas de precios.
// Reemplaza a apiPriceLists.js (legacy).

import { httpBiz } from './apiBusinesses';

export const ArticleListsAPI = {
  // GET /api/businesses/:bizId/article-lists
  list(bizId) {
    return httpBiz('/article-lists', { method: 'GET' }, bizId);
  },

  // GET /api/businesses/:bizId/article-lists/full-state
  // Devuelve { lists, byList: { _base: {...}, [listId]: {...} } }
  fullState(bizId) {
    return httpBiz('/article-lists/full-state', { method: 'GET' }, bizId);
  },

  // POST /api/businesses/:bizId/article-lists
  create(bizId, { name, description = null, color = null, ajuste_pct = 0 } = {}) {
    return httpBiz('/article-lists', {
      method: 'POST',
      body: { name, description, color, ajuste_pct },
    }, bizId);
  },

  // PUT /api/businesses/:bizId/article-lists/:listId
  update(bizId, listId, patch = {}) {
    return httpBiz(`/article-lists/${listId}`, {
      method: 'PUT',
      body: patch,
    }, bizId);
  },

  // DELETE /api/businesses/:bizId/article-lists/:listId
  remove(bizId, listId) {
    return httpBiz(`/article-lists/${listId}`, { method: 'DELETE' }, bizId);
  },

  // POST /api/businesses/:bizId/article-lists/:listId/set-favorite
  setFavorite(bizId, listId) {
    return httpBiz(`/article-lists/${listId}/set-favorite`, { method: 'POST' }, bizId);
  },

  // GET /api/businesses/:bizId/article-lists/:listId/items
  getItems(bizId, listId) {
    return httpBiz(`/article-lists/${listId}/items`, { method: 'GET' }, bizId);
  },

  // PUT /api/businesses/:bizId/article-lists/:listId/items
  addItems(bizId, listId, ids = []) {
    return httpBiz(`/article-lists/${listId}/items`, {
      method: 'PUT',
      body: { ids },
    }, bizId);
  },

  // DELETE /api/businesses/:bizId/article-lists/:listId/items/:articleId
  removeItem(bizId, listId, articleId) {
    return httpBiz(`/article-lists/${listId}/items/${articleId}`, { method: 'DELETE' }, bizId);
  },
};

export default ArticleListsAPI;