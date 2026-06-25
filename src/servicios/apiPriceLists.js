// src/servicios/apiPriceLists.js
// API de listas de precios custom de Lazarillo (Salon, Mostrador, etc).
// Tabla price_lists, endpoints /price-lists/*.

import { httpBiz } from './apiBusinesses';

export const PriceListsAPI = {
  // GET /api/businesses/:bizId/price-lists
  list(bizId) {
    return httpBiz('/price-lists', { method: 'GET' }, bizId);
  },

  // GET /api/businesses/:bizId/price-lists/full-state
  // Devuelve { lists, byList: { _base: {...}, [listId]: {...} } }
  fullState(bizId) {
    return httpBiz('/price-lists/full-state', { method: 'GET' }, bizId);
  },

  // POST /api/businesses/:bizId/price-lists
  create(bizId, { name, description = null, color = null, ajuste_pct = 0 } = {}) {
    return httpBiz('/price-lists', {
      method: 'POST',
      body: { name, description, color, ajuste_pct },
    }, bizId);
  },

  // PUT /api/businesses/:bizId/price-lists/:listId
  update(bizId, listId, patch = {}) {
    return httpBiz(`/price-lists/${listId}`, {
      method: 'PUT',
      body: patch,
    }, bizId);
  },

  // DELETE /api/businesses/:bizId/price-lists/:listId
  remove(bizId, listId) {
    return httpBiz(`/price-lists/${listId}`, { method: 'DELETE' }, bizId);
  },

  // POST /api/businesses/:bizId/price-lists/:listId/set-favorite
  setFavorite(bizId, listId) {
    return httpBiz(`/price-lists/${listId}/set-favorite`, { method: 'POST' }, bizId);
  },
};

export default PriceListsAPI;