// src/hooks/useVentasSummary.js
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useActiveBusiness } from '../context/ActiveBusinessProvider';
import { useDebouncedValue } from './useDebouncedValue';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { qk, STALE } from '@/lib/reactQueryClient'; // ⬅️ MISMO ARCHIVO

export function useVentasSummary({ from, to, limit = 1000, enabled = true }) {
  const { businessId } = useActiveBusiness();

  const dFrom = useDebouncedValue(from, 500);
  const dTo   = useDebouncedValue(to, 500);

  const abortRef = useRef(null);

  const _enabled =
    enabled &&
    !!businessId &&
    typeof dFrom === 'string' &&
    typeof dTo === 'string';

  return useQuery({
    enabled: _enabled,
    queryKey: qk.ventasSummary(businessId, dFrom, dTo, limit),
    staleTime: STALE.SALES ?? 10 * 60 * 1000,
    queryFn: async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const data = await BusinessesAPI.salesSummary(businessId, {
        from: dFrom,
        to: dTo,
        limit,
      });

      return data;
    },
  });
}
