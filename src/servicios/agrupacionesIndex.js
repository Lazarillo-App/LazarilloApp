// src/servicios/agrupacionesIndex.js
/* Crea índices para resolver rápido en qué agrupación está un artículo
   y también buscar por nombre de artículo en todas las agrupaciones. */
const normIdx = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const esGrupoGlobal = (g) => {
  const n = normIdx(g?.nombre);
  return n === 'sin agrupacion' || n === 'discontinuados' || n === 'descontinuados';
};

export function buildAgrupacionesIndex(agrupaciones = []) {
  const byArticleId = new Map();      // idArticulo -> Set(agrupacionId)
  const groupNameById = new Map();    // agrupacionId -> nombre
  const articleNamesLcase = [];       // [{ id, nameLc, agrupacionId }]

  for (const g of agrupaciones) {
    if (!g) continue;
    groupNameById.set(g.id, g.nombre || g.name || `Agrupación #${g.id}`);
    const isGlobal = esGrupoGlobal(g);

    // Leer articulos del JSONB (objetos con id y nombre)
    const articulos = Array.isArray(g.articulos) ? g.articulos : [];
    for (const a of articulos) {
      const id = Number(a?.id ?? a?.articulo_id);
      if (!Number.isFinite(id)) continue;
      if (!byArticleId.has(id)) byArticleId.set(id, new Set());
      byArticleId.get(id).add(g.id);

      // Solo indexar nombres en grupos reales (no globales) para búsqueda textual
      if (!isGlobal) {
        const name = (a?.nombre || a?.name || "").trim();
        if (name) {
          articleNamesLcase.push({ id, nameLc: name.toLowerCase(), agrupacionId: g.id });
        }
      }
    }

    // Tambien leer app_articles_ids (array de IDs numericos, usado por subnegocios)
    if (!isGlobal) {
      const appIds = Array.isArray(g.app_articles_ids) ? g.app_articles_ids : [];
      for (const raw of appIds) {
        const id = Number(raw);
        if (!Number.isFinite(id) || id <= 0) continue;
        if (!byArticleId.has(id)) byArticleId.set(id, new Set());
        byArticleId.get(id).add(g.id);
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