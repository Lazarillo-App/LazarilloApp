import { useQuery } from '@tanstack/react-query';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { qk, STALE } from '@/lib/reactQueryClient';

export function useArticlesTree(bizId) {
  return useQuery({
    enabled: Number.isFinite(bizId) && bizId > 0,
    queryKey: qk.articlesTree(bizId),
    staleTime: STALE.CATALOG,
    gcTime: STALE.CATALOG,
    queryFn: () => BusinessesAPI.articlesTree(bizId),
    select: (d) => d?.tree ?? [],
  });
}
