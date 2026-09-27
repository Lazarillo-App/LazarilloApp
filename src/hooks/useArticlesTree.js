import { useQuery } from '@tanstack/react-query';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { qk, STALE } from '@/lib/reactQueryClient';
import { buildTreeFromFlat } from '@/utils/articlesTree';

// Trae el árbol subrubro→categoría→artículos de un negocio. Si /articles/tree
// FALLA (excepción real: red, 5xx, etc.), cae al fallback de listado plano +
// armado de árbol en cliente — mismo comportamiento que tenía el fetch manual
// de TablaArticulos.jsx. Un árbol vacío con respuesta OK (negocio nuevo sin
// Maxi, catálogo realmente vacío) NO dispara el fallback: antes forzaba un
// segundo round-trip a /articles innecesario, y era la demora que se notaba
// al entrar a Menu en un negocio recién creado.
async function fetchArticlesTree(bizId) {
  try {
    const resp = await BusinessesAPI.articlesTree(bizId);
    return Array.isArray(resp?.tree) ? resp.tree : [];
  } catch {
    const resp2 = await BusinessesAPI.articlesFromDB(bizId);
    const items = Array.isArray(resp2?.items) ? resp2.items : [];
    return buildTreeFromFlat(items);
  }
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
