// src/hooks/useSalesData.js
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * ✅ OPTIMIZADO: Usa /summary en lugar de /items
 *
 * FIX doble llamada:
 * - syncVersion se lee desde un ref DENTRO del fetch (no es dep de useCallback)
 * - Así fetchData solo se recrea cuando cambia businessId/from/to
 * - Cuando sube syncVersion, el useEffect lo re-ejecuta con la MISMA referencia
 *   de fetchData → exactamente UNA llamada por evento
 *
 * El problema anterior: cambiar período disparaba setSyncVersion() en un useEffect
 * separado, lo que causaba que fetchData se recreara DOS veces en el mismo ciclo
 * (una por from/to, otra por syncVersion) → doble HTTP request.
 */
export function useSalesData({
  businessId,
  from,
  to,
  enabled = true,
  syncVersion = 0,
  branchId = null,       // number = sucursal real, null = todas, 'main' = principal sin branch
}) {
  const [ventasMap, setVentasMap] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const reqIdRef = useRef(0);
  const cacheRef = useRef(new Map());

  // ✅ syncVersion como ref: fetchData puede leer su valor sin ser dep de useCallback
  const syncVersionRef = useRef(syncVersion);
  useEffect(() => {
    syncVersionRef.current = syncVersion;
  }, [syncVersion]);

  const fetchData = useCallback(async () => {
    if (!businessId || !from || !to) {
      setVentasMap(new Map());
      return;
    }

    // La cacheKey incluye syncVersion del ref → invalida cache en cada sync
    const cacheKey = `${businessId}|${from}|${to}|${syncVersionRef.current}|${branchId === "main" ? "main" : (branchId ?? "all")}`;

    if (cacheRef.current.has(cacheKey)) {
      console.log("🔄 [useSalesData] Usando CACHE");
      const cached = cacheRef.current.get(cacheKey);
      setVentasMap(new Map(cached));
      return;
    }

    reqIdRef.current += 1;
    const myId = reqIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const MAXI_ENABLED = import.meta.env.VITE_MAXI_ENABLED === "true";

      // 'main' = datos sin branch_id (principal), null = todos, number = sucursal específica
      const branchParam = branchId && branchId !== 'main' ? `&branch_id=${branchId}`
                        : branchId === 'main'             ? `&branch_id=main`
                        : '';
      const url = MAXI_ENABLED
        ? `https://lazarilloapp-backend.onrender.com/api/businesses/${businessId}/sales/items?from=${from}&to=${to}${branchParam}`
        : `https://lazarilloapp-backend.onrender.com/api/businesses/${businessId}/sales/summary?from=${from}&to=${to}&source=csv${branchParam}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Business-Id": String(businessId),
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const resp = await response.json();

      if (myId !== reqIdRef.current) {
        console.log("⏭️ [useSalesData] Request cancelado (nuevo request en curso)");
        return;
      }

      let rows = [];
      if (Array.isArray(resp)) rows = resp;
      else if (resp?.items) rows = Array.isArray(resp.items) ? resp.items : [];

      const map = new Map();

      for (const r of rows) {
        const id = Number(r.article_id ?? r.articuloId ?? r.articulo_id ?? r.id);
        if (!Number.isFinite(id) || id <= 0) continue;

        const qty = Number(r.total_qty ?? r.qty ?? r.cantidad ?? r.unidades ?? 0);
        const amount = Number(
          r.total_amount ??
            r.calcAmount ??
            r.amount ??
            r.total ??
            r.importe ??
            r.monto ??
            0
        );

        if (!Number.isFinite(qty) || !Number.isFinite(amount)) continue;

        map.set(id, { qty, amount });
      }

      // Duplicar keys como string para compatibilidad
      for (const [id, data] of Array.from(map.entries())) {
        if (typeof id === "number") map.set(String(id), { ...data });
      }

      window.__DEBUG_VENTAS_MAP = map;

      cacheRef.current.set(cacheKey, map);

      if (cacheRef.current.size > 20) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      setVentasMap(new Map(map));
    } catch (err) {
      console.error("❌ [useSalesData] error:", err);
      setError(err?.message || "Error al cargar ventas");
      setVentasMap(new Map());
    } finally {
      if (myId === reqIdRef.current) setIsLoading(false);
    }
  }, [businessId, from, to, branchId]);
  // ✅ syncVersion NO está en las deps — se lee del ref adentro

  useEffect(() => {
    if (!enabled) {
      setVentasMap(new Map());
      return;
    }
    fetchData();
    // syncVersion acá dispara re-ejecución del efecto,
    // pero fetchData NO se recrea por eso → UNA sola llamada HTTP
  }, [enabled, fetchData, syncVersion]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    ventasMap,
    isLoading,
    error,
    refetch: fetchData,
    clearCache,
  };
}

export function getVentasFromMap(map, articleId) {
  if (!map) return { qty: 0, amount: 0 };

  const idNum = Number(articleId);
  if (Number.isFinite(idNum)) {
    const byNum = map.get(idNum);
    if (byNum) return byNum;
  }

  const byStr = map.get(String(articleId));
  if (byStr) return byStr;

  return { qty: 0, amount: 0 };
}