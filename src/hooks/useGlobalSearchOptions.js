// src/hooks/useGlobalSearchOptions.js
//
// Hook compartido para el buscador global.
// Devuelve la lista combinada de artículos + insumos del negocio activo.
// Cada opción lleva un campo `tipo` ('articulo' | 'insumo') que permite
// renderizar un chip y decidir a qué página navegar cuando se elige.

import { useState, useEffect, useMemo } from 'react';
import { insumosList } from '@/servicios/apiInsumos';
import { BusinessesAPI } from '@/servicios/apiBusinesses';
import { obtenerAgrupaciones } from '@/servicios/apiAgrupaciones';

export function useGlobalSearchOptions(bizId, insumosBizId = null) {
  const [articulos, setArticulos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  // IDs de artículos que son miembros de la agrupación "Promociones" — no solo los
  // wrappers de id negativo (crearPromocion), sino cualquier artículo normal que el
  // usuario haya sumado a mano a ese grupo. Ambos deben verse etiquetados.
  const [promoMemberIds, setPromoMemberIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  // No usa React Query — es estado propio, así que sin esto solo se refrescaba si
  // cambiaba bizId (crear/editar un artículo o insumo no lo hacía, quedando el
  // buscador global con la lista vieja hasta recargar toda la página).
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const bump = () => setRefreshTick(t => t + 1);
    window.addEventListener('business:synced', bump);
    window.addEventListener('articulos:updated', bump);
    window.addEventListener('insumos:updated', bump);
    return () => {
      window.removeEventListener('business:synced', bump);
      window.removeEventListener('articulos:updated', bump);
      window.removeEventListener('insumos:updated', bump);
    };
  }, []);

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
      insumosList(insumosBizId || bizId, { limit: 99999 }).catch(() => ({ data: [] })),
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
  }, [bizId, insumosBizId, refreshTick]);

  useEffect(() => {
    if (!bizId) { setPromoMemberIds(new Set()); return; }
    let alive = true;
    Promise.allSettled([
      obtenerAgrupaciones(bizId),
      BusinessesAPI.getPromoIds(bizId),
    ]).then(([agRes, promoRes]) => {
      if (!alive) return;
      const ids = new Set();
      if (agRes.status === 'fulfilled') {
        const list = agRes.value?.list;
        const promoGroup = (list || []).find(g => String(g?.nombre || '').trim().toLowerCase() === 'promociones');
        if (promoGroup) {
          for (const a of (promoGroup.articulos || [])) {
            const id = Number(a?.id ?? a?.articulo_id ?? a);
            if (Number.isFinite(id)) ids.add(id);
          }
          for (const id of (promoGroup.app_articles_ids || [])) {
            const n = Number(id);
            if (Number.isFinite(n)) ids.add(n);
          }
        }
      }
      // Fuente real: artículos dueños de una receta con es_promo=TRUE. El id
      // negativo por sí solo NO implica promo — también lo usan los artículos
      // manuales comunes, así que no sirve como heurística (ver esPromo abajo).
      if (promoRes.status === 'fulfilled') {
        for (const id of (promoRes.value?.ids || [])) {
          const n = Number(id);
          if (Number.isFinite(n)) ids.add(n);
        }
      }
      setPromoMemberIds(ids);
    }).catch(() => { if (alive) setPromoMemberIds(new Set()); });
    return () => { alive = false; };
  }, [bizId, refreshTick]);

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
        // Artículo-promo: tiene una receta con es_promo=TRUE (ver getPromoIds en el
        // backend) o fue sumado a mano a la agrupación "Promociones". El id negativo
        // NO alcanza como señal: también lo usan los artículos manuales comunes.
        esPromo: promoMemberIds.has(id),
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
  }, [articulos, insumos, promoMemberIds]);

  return { opciones, loading };
}