// src/servicios/ventasCache.js
const _cache = new Map(); // key -> payload
export const ventasCache = {
  get: (k) => _cache.get(k),
  set: (k, v) => _cache.set(k, v),
  has: (k) => _cache.has(k),
  clear: () => _cache.clear(),
};
