import { useState, useEffect } from 'react';
import { getBusinessPrices } from '@/servicios/apiPriceLists';

/**
 * Trae los precios Maxi para el negocio activo según su lista configurada.
 * Devuelve: { prices: { [codigo]: { precio, precioOriginal, precioPrincipal } }, listNumber, loading }
 */
export function useBusinessPrices(bizId) {
  const [data,    setData]    = useState({ prices: {}, listNumber: 1, discountPct: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bizId) return;
    let cancelled = false;
    setLoading(true);
    getBusinessPrices(bizId)
      .then(res => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData({ prices: {}, listNumber: 1, discountPct: null }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bizId]);

  return { ...data, loading };
}