// src/hooks/useVentasSeries.js
import { useQuery } from '@tanstack/react-query';
import { obtenerVentasSeriesDB } from '../servicios/apiVentas';
import { useActiveBusiness } from '../context/BusinessContext';

export function useVentasSeries({
  
  articuloId,
  from,
  to,
  groupBy = 'day',
  enabled = true,
}) {
  const { businessId } = useActiveBusiness();
  const bizId = Number(businessId);

  const canRun =
    enabled &&
    !!articuloId &&
    !!from &&
    !!to &&
    Number.isFinite(bizId);

  return useQuery({
    queryKey: ['ventas-series', { bizId, articuloId, from, to, groupBy }],
    enabled: canRun,
    queryFn: () =>
      obtenerVentasSeriesDB({
        articuloId,
        from,
        to,
        groupBy,
        businessId: bizId,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
