// src/hooks/useSalesData.js
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * ✅ BYPASS TEMPORAL: Llama directamente a producción con filtro CSV
 */
export function useSalesData({
  businessId,
  from,
  to,
  enabled = true,
  syncVersion = 0,
}) {
  const [ventasMap, setVentasMap] = useState(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const reqIdRef = useRef(0);
  const cacheRef = useRef(new Map()); // cacheKey -> Map

  const fetchData = useCallback(async () => {
    if (!businessId || !from || !to) {
      setVentasMap(new Map()); // ✅ new ref
      return;
    }

    const cacheKey = `${businessId}|${from}|${to}`;

    // ✅ CACHE: CLONAR para forzar re-render (no pasar la misma referencia)
    if (cacheRef.current.has(cacheKey)) {
      console.log("🔄 [useSalesData] Usando CACHE");
      const cached = cacheRef.current.get(cacheKey);
      setVentasMap(new Map(cached)); // ✅ new ref SIEMPRE
      return;
    }

    reqIdRef.current += 1;
    const myId = reqIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const MAXI_ENABLED = import.meta.env.VITE_MAXI_ENABLED === "true";

      const url = MAXI_ENABLED
        ? `https://lazarilloapp-backend.onrender.com/api/businesses/${businessId}/sales/items?from=${from}&to=${to}`
        : `https://lazarilloapp-backend.onrender.com/api/businesses/${businessId}/sales/items?from=${from}&to=${to}&source=csv&limit=500000`;

      console.log("🚀 [useSalesData] Fetch DIRECTO a producción:", url);
      console.log("📌 [useSalesData] MAXI_ENABLED:", MAXI_ENABLED);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Business-Id": String(businessId),
        },
      });

      console.log("📡 [useSalesData] Response status:", response.status);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const resp = await response.json();

      console.log("🔬 [useSalesData] Resumen backend:", {
        ok: resp?.ok,
        business_id: resp?.business_id,
        from: resp?.from,
        to: resp?.to,
        totals: resp?.totals,
        items_length: resp?.items?.length,
      });

      if (myId !== reqIdRef.current) {
        console.log("⏭️ [useSalesData] Request cancelado (nuevo request en curso)");
        return;
      }

      // Normalizar respuesta a rows
      let rows = [];
      if (Array.isArray(resp)) rows = resp;
      else if (resp?.items) rows = Array.isArray(resp.items) ? resp.items : [];

      console.info(`✅ [useSalesData] Recibidas ${rows.length} filas`);
      console.info("📦 [useSalesData] Totales backend:", resp?.totals);

      // 🗺️ Construir mapa NUEVO (y objetos nuevos)
      const map = new Map();

      for (const r of rows) {
        const id = Number(r.article_id ?? r.articuloId ?? r.articulo_id ?? r.id);
        if (!Number.isFinite(id) || id <= 0) continue;

        const qty = Number(r.qty ?? r.cantidad ?? r.unidades ?? r.total_qty ?? 0);
        const amount = Number(
          r.calcAmount ??
            r.amount ??
            r.total ??
            r.importe ??
            r.monto ??
            r.total_amount ??
            0
        );

        if (!Number.isFinite(qty) || !Number.isFinite(amount)) continue;

        const prev = map.get(id) || { qty: 0, amount: 0 };
        const updated = { qty: prev.qty + qty, amount: prev.amount + amount };

        map.set(id, updated);
      }

      // duplicar keys string (si querés compat)
      for (const [id, data] of Array.from(map.entries())) {
        // OJO: Array.from para no iterar sobre el map mientras lo mutás
        if (typeof id === "number") map.set(String(id), { ...data });
      }

      console.info(
        `🗺️ [useSalesData] Map construido con ${Math.floor(map.size / 2)} entradas únicas (x2 num+str)`
      );

      window.__DEBUG_VENTAS_MAP = map;

      // ✅ GUARDAR EN CACHE como Map, ok
      cacheRef.current.set(cacheKey, map);

      // Limitar cache
      if (cacheRef.current.size > 20) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      // ✅ SETEAR state con un MAP NUEVO (clonado) para garantizar re-render
      setVentasMap(new Map(map));
    } catch (err) {
      console.error("❌ [useSalesData] error:", err);
      setError(err?.message || "Error al cargar ventas");
      setVentasMap(new Map()); // ✅ new ref
    } finally {
      if (myId === reqIdRef.current) setIsLoading(false);
    }
  }, [businessId, from, to]);

  useEffect(() => {
    if (!enabled) {
      setVentasMap(new Map()); // ✅ new ref
      return;
    }
    fetchData();
  }, [enabled, syncVersion, fetchData]);

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
