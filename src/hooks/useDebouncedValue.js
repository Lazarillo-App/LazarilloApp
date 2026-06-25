// src/hooks/useBusinessPrices.js
// Trae los precios Maxi para el negocio activo según su lista configurada.
// Devuelve: { prices: { [codigo]: precio }, listNumber, discountPct, loading }
// El back aplica el descuento y las excepciones antes de devolver.

import { useState, useEffect } from 'react';
import { getBusinessPrices } from '@/servicios/apiMaxiPriceLists';

export function useBusinessPrices(bizId) {
  const [prices,      setPrices]      = useState({});
  const [listNumber,  setListNumber]  = useState(1);
  const [discountPct, setDiscountPct] = useState(null);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    if (!bizId) return;
    let cancelled = false;
    setLoading(true);

    getBusinessPrices(bizId)
      .then(res => {
        if (cancelled) return;
        setPrices(res?.prices ?? {});
        setListNumber(res?.listNumber ?? 1);
        setDiscountPct(res?.discountPct ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setPrices({});
        setListNumber(1);
        setDiscountPct(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [bizId]);

  return { prices, listNumber, discountPct, loading };
}
