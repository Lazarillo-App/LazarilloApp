// src/hooks/useGlobalSearchOptions.js
//
// Hook compartido para el buscador global.
// Devuelve la lista combinada de artículos + insumos del negocio activo.
// Cada opción lleva un campo `tipo` ('articulo' | 'insumo') que permite
// renderizar un chip y decidir a qué página navegar cuando se elige.

import { useState, useEffect, useMemo } from 'react';
import { insumosList } from '@/servicios/apiInsumos';
import { BusinessesAPI } from '@/servicios/apiBusinesses';

export function useGlobalSearchOptions(bizId) {
  const [articulos, setArticulos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bizId) {
      setArticulos([]);
      setInsumos([]);
      return;
    }
    let alive = true;
    setLoading(true);

    Promise.allSettled([
      BusinessesAPI.articlesFromDB(bizId).catch(() => ({ items: [] })),
      insumosList(bizId, { limit: 99999 }).catch(() => ({ data: [] })),
    ]).then(([artRes, insRes]) => {
      if (!alive) return;

      const arts = artRes.status === 'fulfilled'
        ? (Array.isArray(artRes.value?.items) ? artRes.value.items : [])
        : [];

      const ins = insRes.status === 'fulfilled'
        ? (Array.isArray(insRes.value?.data) ? insRes.value.data
            : Array.isArray(insRes.value?.insumos) ? insRes.value.insumos : [])
        : [];

      setArticulos(arts);
      setInsumos(ins);
      setLoading(false);
    });

    return () => { alive = false; };
  }, [bizId]);

  const opciones = useMemo(() => {
    const out = [];
    const seen = new Set();

    for (const a of articulos) {
      const id = Number(a?.id);
      if (!Number.isFinite(id) || id === 0) continue;
      const key = `art-${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nombre = String(a.nombre || '').trim() || `ART-${id}`;
      const codigo = String(a.codigo_maxi || a.codigo || a.sku || id).trim();

      out.push({
        id,
        nombre,
        codigo,
        tipo: 'articulo',
        _key: key,
      });
    }

    for (const i of insumos) {
      const id = Number(i?.id);
      if (!Number.isFinite(id) || id === 0) continue;
      const key = `ins-${id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nombre = String(i.nombre || '').trim() || `INS-${id}`;
      const codigo = String(i.codigo_maxi || i.codigo_mostrar || i.codigo || id).trim();

      out.push({
        id,
        nombre,
        codigo,
        tipo: 'insumo',
        _key: key,
      });
    }

    return out;
  }, [articulos, insumos]);

  return { opciones, loading };
}