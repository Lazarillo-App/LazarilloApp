// src/hooks/useSalesByArticle.js
import { useQuery } from '@tanstack/react-query';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { aggregateByArticle } from '@/servicios/apiSalesDaily';
import { useActiveBusiness } from '@/context/ActiveBusinessProvider';

/**
 * Trae ventas agregadas por artículo en un rango de fechas
 * usando el summary del backend (/businesses/:id/sales/summary)
 */
export function useSalesByArticle({
  from,
  to,
  enabled = true,
  limit = 5000,
}) {
  const { businessId } = useActiveBusiness();   // 👈 unificamos con el resto
  const bizId = Number(businessId);

  const isEnabled =
    enabled &&
    Number.isFinite(bizId) &&
    typeof from === 'string' &&
    typeof to === 'string';

  return useQuery({
    queryKey: ['sales-by-article', bizId, from, to, limit],
    enabled: isEnabled,
    queryFn: async () => {
      // Usa el resumen que ya probaste con Postman (noviembre ok)
      const rows = await BusinessesAPI.getSalesItems(bizId, {
        from,
        to,
        limit,
      });
      return Array.isArray(rows) ? rows : [];
    },
    select: (rows) => {
      const items = Array.isArray(rows) ? rows : [];
      return {
        rows: items,                  // crudo desde el back
        byArticle: aggregateByArticle(items), // [{ articleId, title, qty, amount }]
      };
    },
  });
}
