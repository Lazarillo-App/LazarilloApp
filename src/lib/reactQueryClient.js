/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import { QueryClient, QueryCache } from '@tanstack/react-query';

/** Tiempos sugeridos por tipo de dato */
export const STALE = {
  ULTRA_SHORT: 30 * 1000,        // UI hints muy volátiles
  SHORT:       2  * 60 * 1000,   // listados “vivos”
  SALES:       10 * 60 * 1000,   // ventas agregadas por rango
  CATALOG:     60 * 60 * 1000,   // catálogo (no cambia tanto)
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (process.env.NODE_ENV !== 'production') {
        // Útil para detectar queries ruidosas
        console.warn('[RQ] error', query?.queryKey, error?.message || error);
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      keepPreviousData: true,

      retry: (failureCount, error) => failureCount < 1, // 1 intento de retry
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),

      staleTime: 5 * 60 * 1000,   // 5 min
      gcTime:    15 * 60 * 1000,  // 15 min
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Claves estándar para cache. Úsalas en tus `useQuery`:
 *   useQuery({ queryKey: qk.articlesTree(bizId), queryFn, staleTime: STALE.CATALOG })
 */
export const qk = {
  business:        (id)                        => ['biz', Number(id)],
  articlesTree:    (id)                        => ['articlesTree', Number(id)],
  articlesFlat:    (id)                        => ['articlesFlat', Number(id)],
  ventasSummary:   (id, from, to, limit = 1000)=> ['ventasSummary', Number(id), from, to, limit],
  ventasSeries:    (id, artId, from, to, g='day') =>
                                            ['ventasSeries', Number(id), Number(artId), from, to, g],
};
