/* eslint-disable no-unused-vars */
// src/hooks/useSalesData.js
import { useState, useEffect, useRef } from 'react';

/**
 * ✅ BYPASS TEMPORAL: Llama directamente a producción
 */
export function useSalesData({ businessId, from, to, enabled = true, syncVersion = 0 }) {
  const [ventasMap, setVentasMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const reqIdRef = useRef(0);
  const cacheRef = useRef(new Map());

  const fetchData = async () => {
    if (!businessId || !from || !to) {
      setVentasMap(new Map());
      return;
    }

    const cacheKey = `${businessId}|${from}|${to}`;

    if (cacheRef.current.has(cacheKey)) {
      console.log('🔄 [useSalesData] Usando CACHE');
      setVentasMap(cacheRef.current.get(cacheKey));
      return;
    }

    reqIdRef.current += 1;
    const myId = reqIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      // 🔴 BYPASS: Llamar directamente a producción
      const token = localStorage.getItem('token');
      const url = `https://lazarilloapp-backend.onrender.com/api/businesses/${businessId}/sales/items?from=${from}&to=${to}`;

      console.log('🚀 [useSalesData] Fetch DIRECTO a producción:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 [useSalesData] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const resp = await response.json();
      console.log('🔬 [useSalesData] Respuesta COMPLETA del backend:', {
        ok: resp.ok,
        business_id: resp.business_id,
        from: resp.from,
        to: resp.to,
        totals: resp.totals,
        items_length: resp.items?.length,
        items_sample: resp.items?.slice(0, 3),
        ranking_length: resp.ranking?.length,
        tiene_items: !!resp.items,
        tiene_ranking: !!resp.ranking,
      });

      if (myId !== reqIdRef.current) {
        console.log('⏭️ [useSalesData] Request cancelado (nuevo request en curso)');
        return;
      }

      // Normalizar respuesta
      let rows = [];
      if (Array.isArray(resp)) {
        rows = resp;
      } else if (resp?.items) {
        rows = Array.isArray(resp.items) ? resp.items : [];
      } else if (resp?.ranking) {
        rows = Array.isArray(resp.ranking) ? resp.ranking : [];
      }

      console.info(`✅ [useSalesData] Recibidas ${rows.length} filas DESDE PRODUCCIÓN`);
      console.info(`📦 [useSalesData] Totales backend:`, resp?.totals);

      // 🗺️ Construir mapa
      const map = new Map();
      const articulosPorDia = {};

      for (const r of rows) {
        const id = Number(
          r.article_id ??
          r.articuloId ??
          r.articulo_id ??
          r.id
        );

        if (!Number.isFinite(id) || id <= 0) continue;

        const day = r.day || 'sin_dia';

        // ✅ Convertir strings a números PRIMERO
        const qty = Number(r.qty ?? r.cantidad ?? r.unidades ?? r.total_qty ?? 0);
        const amount = Number(r.amount ?? r.total ?? r.importe ?? r.monto ?? r.total_amount ?? 0);

        // Validar que son números finitos
        if (!Number.isFinite(qty) || !Number.isFinite(amount)) {
          console.warn(`[useSalesData] Valores inválidos para artículo ${id}:`, { qty, amount });
          continue;
        }

        // Debug: contar días
        if (!articulosPorDia[id]) {
          articulosPorDia[id] = new Set();
        }
        articulosPorDia[id].add(day);

        // ✅ Acumular valores
        const prev = map.get(id) || { qty: 0, amount: 0 };

        // Crear NUEVO objeto (no mutar)
        const updated = {
          qty: prev.qty + qty,
          amount: prev.amount + amount,
        };

        // Setear SOLO con key numérica
        map.set(id, updated);
      }

      // ✅ Ahora SÍ copiar a keys string (DESPUÉS del loop)
      for (const [id, data] of map.entries()) {
        map.set(String(id), { ...data });  // Copiar el objeto
      }

      console.info(`🗺️ [useSalesData] Map construido con ${map.size / 2} entradas únicas (x2 por keys num+str)`);

      // Log de artículos con múltiples días
      const multiDia = Object.entries(articulosPorDia)
        .filter(([id, dias]) => dias.size > 1)
        .slice(0, 5);

      if (multiDia.length > 0) {
        console.log('📅 [useSalesData] Artículos con ventas en múltiples días:');
        console.table(multiDia.map(([id, dias]) => ({
          id,
          dias: dias.size,
          dias_detalle: Array.from(dias).slice(0, 3).join(', ')
        })));
      }

      // Verificación específica de artículos problema
      const testIds = [123, 124, 2, 5];
      console.log('🧪 [useSalesData] Verificación artículos específicos:');
      console.table(testIds.map(id => {
        const data = map.get(id);
        return {
          id,
          qty: data?.qty || 0,
          amount: data?.amount || 0,
          ratio: data?.qty ? (data.amount / data.qty).toFixed(2) : 'N/A',
          dias: articulosPorDia[id]?.size || 0
        };
      }));

      // Muestra
      if (map.size > 0) {
        const sample = Array.from(map.entries()).slice(0, 5);
        console.log('📊 [useSalesData] Muestra:');
        console.table(sample.map(([id, data]) => ({
          id,
          qty: data.qty,
          amount: data.amount.toFixed(2),
          ratio: data.qty ? (data.amount / data.qty).toFixed(2) : 'N/A'
        })));
      }

      window.__DEBUG_VENTAS_MAP = map;

      cacheRef.current.set(cacheKey, map);

      if (cacheRef.current.size > 20) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      setVentasMap(map);

    } catch (err) {
      console.error('❌ [useSalesData] error:', err);
      setError(err?.message || 'Error al cargar ventas');
      setVentasMap(new Map());
    } finally {
      if (myId === reqIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!enabled) {
      setVentasMap(new Map());
      return;
    }

    fetchData();
  }, [businessId, from, to, enabled, syncVersion]);

  const clearCache = () => {
    cacheRef.current.clear();
  };

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