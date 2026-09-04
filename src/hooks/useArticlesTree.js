import { useQuery } from '@tanstack/react-query';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { qk, STALE } from '@/lib/reactQueryClient';
import { buildTreeFromFlat } from '@/utils/articlesTree';

// Trae el árbol subrubro→categoría→artículos de un negocio. Si /articles/tree viene
// vacío (o falla), cae al fallback de listado plano + armado de árbol en cliente —
// mismo comportamiento que tenía el fetch manual de TablaArticulos.jsx.
async function fetchArticlesTree(bizId) {
  try {
    const resp = await BusinessesAPI.articlesTree(bizId);
    const tree = Array.isArray(resp?.tree) ? resp.tree : [];
    if (tree.length > 0) return tree;
  } catch { /* cae al fallback de abajo */ }

  const resp2 = await BusinessesAPI.articlesFromDB(bizId);
  const items = Array.isArray(resp2?.items) ? resp2.items : [];
  return buildTreeFromFlat(items);
}

export function useArticlesTree(bizId) {
  return useQuery({
    enabled: Number.isFinite(bizId) && bizId > 0,
    queryKey: qk.articlesTree(bizId),
    staleTime: STALE.CATALOG,
    gcTime: STALE.CATALOG,
    queryFn: () => fetchArticlesTree(bizId),
  });
}
