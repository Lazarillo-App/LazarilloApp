// src/servicios/agrupacionesIndex.js
/* Crea índices para resolver rápido en qué agrupación está un artículo
   y también buscar por nombre de artículo en todas las agrupaciones. */
export function buildAgrupacionesIndex(agrupaciones = []) {
  const byArticleId = new Map();      // idArticulo -> Set(agrupacionId)
  const groupNameById = new Map();    // agrupacionId -> nombre
  const articleNamesLcase = [];       // [{ id, nameLc, agrupacionId }]

  for (const g of agrupaciones) {
    if (!g) continue;
    groupNameById.set(g.id, g.nombre || g.name || `Agrupación #${g.id}`);
    const articulos = Array.isArray(g.articulos) ? g.articulos : [];
    for (const a of articulos) {
      const id = Number(a?.id ?? a?.articulo_id);
      if (!Number.isFinite(id)) continue;
      if (!byArticleId.has(id)) byArticleId.set(id, new Set());
      byArticleId.get(id).add(g.id);

      const name = (a?.nombre || a?.name || "").trim();
      if (name) {
        articleNamesLcase.push({ id, nameLc: name.toLowerCase(), agrupacionId: g.id });
      }
    }
  }
  return { byArticleId, groupNameById, articleNamesLcase };
}

/* Dada una query textual, devuelve las agrupaciones donde hay match por nombre. */
export function findGroupsForQuery(query = "", index) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const hitGroupIds = new Set();
  for (const item of index.articleNamesLcase) {
    if (item.nameLc.includes(q)) hitGroupIds.add(item.agrupacionId);
  }
  return Array.from(hitGroupIds);
}
