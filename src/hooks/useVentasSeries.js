/* eslint-disable react-refresh/only-export-components */
import { useQuery } from '@tanstack/react-query';
import { obtenerVentasSeriesDB } from '../servicios/apiVentas';
import { getActiveBusinessId } from '../servicios/apiBusinesses';

export function useVentasSeries({
  articuloId,
  from,
  to,
  groupBy = 'day',
  enabled = true,
}) {
  const bizIdRaw = getActiveBusinessId();
  const bizId = bizIdRaw ? Number(bizIdRaw) : NaN;

  return useQuery({
    queryKey: ['ventas-series', { bizId, articuloId, from, to, groupBy }],
    enabled:
      enabled &&
      !!articuloId &&
      !!from &&
      !!to &&
      Number.isFinite(bizId),
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
