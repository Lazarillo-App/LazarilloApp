// src/hooks/useRankingPorGasto.js
// Ranking "Top N por gasto" del detalle de compras — usado tanto desde
// ComprasMiniDetalleModal.jsx (chip en el cuerpo) como desde RecetaModal/
// index.jsx (chip en el header, junto al nombre, cuando modoInsumo+tab==='compras').
import { useState, useEffect } from 'react';
import { purchasesRanking } from '@/servicios/apiPurchases';

export function useRankingPorGasto({ businessId, rango, insumoId, habilitado = true }) {
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!habilitado || !businessId || !rango?.from || !rango?.to) {
      setRanking(null);
      return;
    }
    let vivo = true;
    setLoading(true);
    purchasesRanking(businessId, { from: rango.from, to: rango.to, pin: insumoId, limit: 20 })
      .then((r) => { if (vivo) setRanking(r); })
      .catch(() => { if (vivo) setRanking(null); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [habilitado, businessId, rango?.from, rango?.to, insumoId]);

  return { ranking, loading };
}
